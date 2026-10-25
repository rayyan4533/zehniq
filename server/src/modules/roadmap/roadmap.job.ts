import { inngest } from "../../inngest/client.js";
import { analyzeRoadmapSources, planRoadmapCurriculum, researchRoadmapForAnalysis } from "./roadmap-generation.service.js";
import { findRoadmapById, updateRoadmapRecord } from "./roadmap.repo.js";
import { roadmapGenerationError } from "./roadmap-errors.js";

export const generateRoadmap = inngest.createFunction({
    id: "generate-roadmap", retries: 2,
    triggers: [{ event: "roadmap/generate" }],
    singleton: { key: "event.data.roadmapId", mode: "skip" },
    concurrency: [{ limit: 1, key: "event.data.roadmapId" }, { limit: 3 }],
    onFailure: async ({ event, step, error }) => {
        const { roadmapId } = event.data.event.data;
        await step.run("mark-roadmap-failed", async () => {
            const roadmap = await findRoadmapById(roadmapId);
            if (!roadmap || roadmap.status === "ready") return;
            await updateRoadmapRecord(roadmapId, {
                status: "failed", phase: "failed",
                generationError: roadmapGenerationError(error.message),
            });
        });
    },
}, async ({ event, step }) => {
    const { roadmapId } = event.data;
    const existing = await step.run("load-roadmap", () => findRoadmapById(roadmapId));
    if (!existing || existing.status === "ready") return { roadmapId, status: existing?.status ?? "deleted" };
    const analysis = await step.run("analyze-sources", () => analyzeRoadmapSources(roadmapId));
    const research = await step.run("research-gaps", () => researchRoadmapForAnalysis(roadmapId, analysis));
    return step.run("plan-curriculum", () => planRoadmapCurriculum(roadmapId, analysis, research));
});
