import { deleteChunksBySourceId, findChunksBySourceId } from "./source-chunk.repo.js";
import { deleteSourceRecord, findSourceById } from "./source.repo.js";
import { chunkSourceContent, embedAndIndexSource, extractSourceContent, markSourceProcessing } from "./source-processing.service.js";
import { deleteSourceVectors } from "../../lib/pinecone/pinecone.js";
import { deleteUploadedPdf } from "../../lib/pdf-cloudinary/cloudinary.js";
import { inngest } from "../../inngest/client.js";

export const processSource = inngest.createFunction(
  {
    id: "process-source",
    retries: 3,
    triggers: [{ event: "source/created" }],
    onFailure: async ({ event, step }) => {
      const { sourceId, workspaceId } = event.data.event.data;
      // Save cleanup information before deleting the database record. Completed
      // steps are replayed if a later external cleanup step needs another attempt.
      const source = await step.run("load-failed-source", () => findSourceById(sourceId));
      if (!source || source.status === "READY") return;
      await step.run("remove-failed-source", async () => {
        await deleteChunksBySourceId(sourceId);
        await deleteSourceRecord(sourceId);
      });
      await Promise.all([
        step.run("remove-failed-vectors", () => deleteSourceVectors(workspaceId, sourceId)),
        step.run("remove-failed-pdf", () => deleteUploadedPdf(source.metadata)),
      ]);
    },
  },
  async ({ event, step }) => {
    const { sourceId } = event.data;
    await step.run("mark-processing", () => markSourceProcessing(sourceId));
    const extracted = await step.run("extract-content", () => extractSourceContent(sourceId));
    await step.run("chunk-content", () => chunkSourceContent(sourceId, extracted.text, extracted.pages));
    const result = await step.run("embed-and-index", async () => {
      const source = await findSourceById(sourceId);
      if (!source) throw new Error("Source not found");
      const chunks = await findChunksBySourceId(sourceId);
      await embedAndIndexSource(source, chunks);
      return { chunkCount: chunks.length };
    });
    return { sourceId, status: "READY", ...result };
  },
);
