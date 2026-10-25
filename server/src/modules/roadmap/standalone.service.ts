import { z } from "zod";
import { inngest } from "../../inngest/client.js";
import { AppError, ConflictError, NotFoundError, ValidationError } from "../../types/app-error.js";
import { createRoadmapService, roadmapDto } from "./roadmap.service.js";
import { roadmapDurationSchema } from "./roadmap.schema.js";
import { updateRoadmapRecord } from "./roadmap.repo.js";
import * as repo from "./standalone.repo.js";
import { createAndProcessSource } from "../source/source.service.js";
import { deleteSourceRecord, type SourceRecord } from "../source/source.repo.js";
import { sourceIndexNamespace } from "../source/source-scope.js";
import { removeSourceFromIndex } from "../source/source-processing.service.js";
import { deleteUploadedPdf, uploadPdfToCloudinary } from "../../lib/pdf-cloudinary/cloudinary.js";
import { extractPdfFromBuffer } from "../../lib/pdf-cloudinary/pdf.js";
import { scrapeWebsite } from "../../lib/website-scrape-tool/firecrawl.js";
import { fetchYoutubeTranscript } from "../../lib/npm-yt-transcript/youtube.js";
import { createSourceSchema, importWebsiteSchema, importYoutubeSchema } from "../source/source.validator.js";
import { publicWebUrl } from "./roadmap-research.js";

export const collectionInput = z.object({ title: z.string().trim().min(1).max(120).default("New learning path") }).strict();
export const standaloneRoadmapInput = z.object({
    durationMonths: roadmapDurationSchema,
    sourceIds: z.array(z.string().trim().min(1).max(160)).max(100).default([]),
    topicGoals: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
}).strict().refine((value) => value.sourceIds.length > 0 || value.topicGoals.length > 0, "Add at least one source or learning topic.");

export async function requireCollection(id: string, userId: string) {
    const collection = await repo.findCollection(id, userId);
    if (!collection) throw new NotFoundError("Learning path not found");
    return collection;
}

// The shared progress/viewer service is scoped to a real standalone collection,
// not a notebook. Ownership and source lookups use collection-specific queries.
export const standaloneRoadmapService = createRoadmapService({
    getWorkspaceByIdForUser: requireCollection,
    findRoadmapsByWorkspaceId: repo.collectionRoadmaps,
    findRoadmapByIdAndWorkspaceId: repo.findCollectionRoadmap,
    findSourceByIdAndWorkspaceId: repo.findCollectionSource,
    findSourcesByWorkspaceId: async (id) => (await repo.collectionSources(id)).filter((source) => source.status === "READY"),
    resourceFilePath: (id, roadmapId, resourceId) => `/roadmaps/collections/${encodeURIComponent(id)}/roadmaps/${encodeURIComponent(roadmapId)}/resources/${encodeURIComponent(resourceId)}/file`,
});

export async function createStandaloneRoadmap(collectionId: string, userId: string, body: unknown) {
    await requireCollection(collectionId, userId);
    const parsed = standaloneRoadmapInput.parse(body);
    const sourceIds = [...new Set(parsed.sourceIds)];
    const topicGoals = [...new Set(parsed.topicGoals)];
    const ready = new Set((await repo.collectionSources(collectionId)).filter((source) => source.status === "READY" && source.content?.trim()).map((source) => source.id));
    if (sourceIds.some((id) => !ready.has(id))) throw new ValidationError("Choose ready sources from this learning path.");
    const row = await repo.createCollectionRoadmap({ collectionId, title: "Your learning roadmap", durationMonths: parsed.durationMonths, sourceIds, topicGoals });
    try { await inngest.send({ name: "roadmap/generate", data: { roadmapId: row.id } }); }
    catch { await updateRoadmapRecord(row.id, { status: "failed", phase: "failed" }); throw new AppError(503, "Roadmap generation couldn’t start. Please try again."); }
    return roadmapDto(row);
}

/** Only public source metadata is returned; file URLs stay behind the PDF proxy. */
export function standaloneSourceDto(source: SourceRecord) {
    return { id: source.id, workspaceId: null, collectionId: source.collectionId, type: source.type, title: source.title, status: source.status, content: null, createdAt: String(source.createdAt) };
}

export async function getCollection(id: string, userId: string) {
    const collection = await requireCollection(id, userId);
    const [sources, defaults] = await Promise.all([repo.collectionSources(id), repo.collectionDefaults(id)]);
    return { id: collection.id, title: collection.title, createdAt: String(collection.createdAt), updatedAt: String(collection.updatedAt), sources: sources.map(standaloneSourceDto), topicGoals: defaults?.topicGoals ?? [] };
}
export async function getCollections(userId: string) {
    return Promise.all((await repo.listCollections(userId)).map(async (collection) => ({ id: collection.id, title: collection.title, createdAt: String(collection.createdAt), updatedAt: String(collection.updatedAt), sourceCount: (await repo.collectionSources(collection.id)).length, roadmaps: await standaloneRoadmapService.list(collection.id, userId) })));
}

export async function addCollectionSource(id: string, userId: string, type: "text" | "website" | "youtube", body: unknown) {
    await requireCollection(id, userId);
    if (type === "text") {
        const input = createSourceSchema.parse(body);
        return standaloneSourceDto(await createAndProcessSource({ collectionId: id, ...input, status: "PENDING" }));
    }
    if (type === "website") {
        const input = importWebsiteSchema.parse(body);
        let url: string;
        try { url = publicWebUrl(input.url).href; }
        catch { throw new ValidationError("Enter a public HTTP or HTTPS website URL."); }
        const scraped = await scrapeWebsite(url);
        return standaloneSourceDto(await createAndProcessSource({ collectionId: id, type: "WEBSITE", title: input.title || scraped.title || input.url, content: scraped.markdown, url: scraped.sourceUrl, status: "PENDING", metadata: { importedFrom: scraped.sourceUrl } }));
    }
    const input = importYoutubeSchema.parse(body);
    const video = await fetchYoutubeTranscript(input.url);
    return standaloneSourceDto(await createAndProcessSource({ collectionId: id, type: "YOUTUBE", title: input.title || `YouTube: ${video.videoId}`, content: video.content, url: input.url, status: "PENDING", metadata: { videoId: video.videoId } }));
}

export async function uploadCollectionPdf(id: string, userId: string, file: Express.Multer.File | undefined, title?: string) {
    await requireCollection(id, userId);
    if (!file) throw new ValidationError("Choose a PDF to upload.");
    let extracted;
    try { extracted = await extractPdfFromBuffer(file.buffer); }
    catch { throw new ValidationError("We couldn’t read this PDF. Use a PDF with selectable text that isn’t password-protected."); }
    const upload = await uploadPdfToCloudinary(file.buffer, file.originalname);
    return standaloneSourceDto(await createAndProcessSource({ collectionId: id, type: "PDF", title: title?.trim().slice(0, 200) || file.originalname.replace(/\.pdf$/i, ""), content: extracted.text, status: "PENDING", metadata: { fileUrl: upload.secureUrl, publicId: upload.publicId, resourceType: upload.resourceType, fileName: upload.originalFilename, pageCount: extracted.pageCount } }));
}

export async function removeCollectionSource(id: string, sourceId: string, userId: string) {
    await requireCollection(id, userId);
    const source = await repo.findCollectionSource(sourceId, id);
    if (!source) throw new NotFoundError("Source not found");
    if (source.status === "PENDING" || source.status === "PROCESSING") throw new ConflictError("Wait for source processing to finish before deleting it.");
    await removeSourceFromIndex(sourceIndexNamespace(source), source.id);
    await deleteUploadedPdf(source.metadata);
    await deleteSourceRecord(source.id);
}
export async function removeCollection(id: string, userId: string) {
    await requireCollection(id, userId);
    const sources = await repo.collectionSources(id);
    if (sources.some((source) => source.status === "PENDING" || source.status === "PROCESSING")) throw new ConflictError("Wait for source processing to finish before deleting this learning path.");
    for (const source of sources) await removeCollectionSource(id, source.id, userId);
    await repo.deleteCollection(id);
}
