import { z } from "zod";
import { inngest } from "../../inngest/client.js";
import { AppError, ConflictError, NotFoundError, ValidationError } from "../../types/app-error.js";
import { getWorkspaceByIdForUser } from "../workspace/workspace.service.js";
import { findSourceByIdAndWorkspaceId, findSourcesByWorkspaceId } from "../source/source.repo.js";
import * as repo from "./roadmap.repo.js";
import { roadmapDurationSchema, validateRoadmapContent } from "./roadmap.schema.js";
import { roadmapProgress, roadmapAnalytics } from "./roadmap-analytics.js";
import { downloadRoadmapPdf } from "./roadmap-pdf.js";
import { publicWebUrl } from "./roadmap-research.js";
import { roadmapGenerationError } from "./roadmap-errors.js";

export const createRoadmapSchema = z.object({
    durationMonths: roadmapDurationSchema,
    sourceIds: z.array(z.string().trim().min(1).max(160)).min(1).max(100).transform((ids) => [...new Set(ids)]),
}).strict();
export const renameRoadmapSchema = z.object({ title: z.string().trim().min(1).max(300) }).strict();
export const taskProgressSchema = z.object({ isCompleted: z.boolean() }).strict();

export function roadmapDto(row: repo.RoadmapRecord, states: repo.RoadmapProgressRecord[] = []) {
    const content = row.content ? validateRoadmapContent(row.content, row.durationMonths) : null;
    const weeks = content?.weeks ?? [];
    const completed = new Set(states.filter((state) => state.isCompleted).map((state) => state.taskId));
    return {
        id: row.id, workspaceId: row.workspaceId, title: row.title,
        collectionId: row.collectionId ?? null,
        topicGoals: row.topicGoals ?? [],
        durationMonths: roadmapDurationSchema.parse(row.durationMonths),
        status: row.status as "generating" | "ready" | "failed", phase: row.phase,
        sourceIds: row.sourceIds,
        weeks: weeks.map((week) => ({ ...week, tasks: week.tasks.map((task) => ({ ...task, isCompleted: completed.has(task.id) })) })),
        resources: content?.resources ?? [],
        limitations: Array.isArray(row.limitations) ? row.limitations.filter((item): item is string => typeof item === "string") : [],
        ...(row.status === "failed" ? { generationError: roadmapGenerationError(row.generationError) } : {}),
        createdAt: String(row.createdAt), updatedAt: String(row.updatedAt),
        progress: roadmapProgress(weeks, states),
    };
}

const dependencies = {
    ...repo, getWorkspaceByIdForUser, findSourcesByWorkspaceId, findSourceByIdAndWorkspaceId, downloadRoadmapPdf,
    enqueue: (roadmapId: string) => inngest.send({ name: "roadmap/generate", data: { roadmapId } }),
};

type RoadmapDependencies = Omit<typeof dependencies, "getWorkspaceByIdForUser"> & {
    getWorkspaceByIdForUser: (scopeId: string, userId: string) => Promise<unknown>;
    resourceFilePath?: (scopeId: string, roadmapId: string, resourceId: string) => string;
};

export function createRoadmapService(overrides: Partial<RoadmapDependencies> = {}) {
    const deps: RoadmapDependencies = { ...dependencies, ...overrides };
    async function access(workspaceId: string, roadmapId: string, userId: string) {
        await deps.getWorkspaceByIdForUser(workspaceId, userId);
        const row = await deps.findRoadmapByIdAndWorkspaceId(roadmapId, workspaceId);
        if (!row) throw new NotFoundError("Roadmap not found");
        return row;
    }
    async function asDto(row: repo.RoadmapRecord) { return roadmapDto(row, await deps.findRoadmapProgress(row.id)); }
    async function resolveResource(workspaceId: string, roadmapId: string, resourceId: string, userId: string) {
        const row = await access(workspaceId, roadmapId, userId);
        if (row.status !== "ready" || !row.content) throw new ConflictError("This roadmap is not ready yet.");
        const content = validateRoadmapContent(row.content, row.durationMonths);
        const resource = content.resources.find((item) => item.id === resourceId);
        if (!resource) throw new NotFoundError("Resource not found");
        const source = resource.origin === "uploaded" && resource.sourceId
            ? await deps.findSourceByIdAndWorkspaceId(resource.sourceId, workspaceId) : null;
        if (resource.origin === "uploaded" && !source) throw new NotFoundError("This source has been removed from the workspace.");
        return { row, resource, source };
    }
    return {
        async list(workspaceId: string, userId: string) {
            await deps.getWorkspaceByIdForUser(workspaceId, userId);
            return Promise.all((await deps.findRoadmapsByWorkspaceId(workspaceId)).map(asDto));
        },
        async create(workspaceId: string, userId: string, input: z.infer<typeof createRoadmapSchema>) {
            await deps.getWorkspaceByIdForUser(workspaceId, userId);
            const parsed = createRoadmapSchema.parse(input);
            const sources = await deps.findSourcesByWorkspaceId(workspaceId, { status: "READY" });
            const eligible = new Set(sources.filter((source) => source.content?.trim()).map((source) => source.id));
            if (parsed.sourceIds.some((id) => !eligible.has(id))) throw new ValidationError("Choose sources that are ready and contain extracted text.");
            const row = await deps.createRoadmapRecord({ workspaceId, title: "Your learning roadmap", ...parsed });
            try { await deps.enqueue(row.id); }
            catch (error) {
                await deps.updateRoadmapRecord(row.id, { status: "failed", phase: "failed", generationError: "The background job could not be queued." });
                throw new AppError(503, "Roadmap generation could not start. Please try again from your roadmap list.");
            }
            return asDto(row);
        },
        async get(workspaceId: string, roadmapId: string, userId: string) { return asDto(await access(workspaceId, roadmapId, userId)); },
        async rename(workspaceId: string, roadmapId: string, userId: string, input: z.infer<typeof renameRoadmapSchema>) {
            await access(workspaceId, roadmapId, userId);
            const row = await deps.updateRoadmapRecord(roadmapId, renameRoadmapSchema.parse(input));
            if (!row) throw new NotFoundError("Roadmap not found");
            return asDto(row);
        },
        async remove(workspaceId: string, roadmapId: string, userId: string) {
            await access(workspaceId, roadmapId, userId);
            await deps.deleteRoadmapRecord(roadmapId);
        },
        async retry(workspaceId: string, roadmapId: string, userId: string) {
            const row = await access(workspaceId, roadmapId, userId);
            if (row.status !== "failed") throw new ConflictError("Only failed roadmaps can be retried.");
            const next = await deps.claimRoadmapRetry(roadmapId);
            if (!next) throw new ConflictError("This roadmap is already being generated.");
            try { await deps.enqueue(roadmapId); }
            catch {
                await deps.updateRoadmapRecord(roadmapId, { status: "failed", phase: "failed", generationError: "The background job could not be queued." });
                throw new AppError(503, "Roadmap generation could not start. Please try again.");
            }
            return asDto(next);
        },
        async setTask(workspaceId: string, roadmapId: string, taskId: string, userId: string, input: z.infer<typeof taskProgressSchema>) {
            const row = await access(workspaceId, roadmapId, userId);
            if (row.status !== "ready" || !row.content) throw new ConflictError("This roadmap is not ready to track progress.");
            const content = validateRoadmapContent(row.content, row.durationMonths);
            if (!content.weeks.some((week) => week.tasks.some((task) => task.id === taskId))) throw new NotFoundError("Task not found");
            await deps.setRoadmapTaskProgress(roadmapId, taskId, taskProgressSchema.parse(input).isCompleted);
            const latest = await deps.findRoadmapByIdAndWorkspaceId(roadmapId, workspaceId);
            if (!latest) throw new NotFoundError("Roadmap not found");
            return asDto(latest);
        },
        async analytics(workspaceId: string, roadmapId: string, userId: string) {
            const row = await access(workspaceId, roadmapId, userId);
            const content = row.content ? validateRoadmapContent(row.content, row.durationMonths) : null;
            const [states, activities] = await Promise.all([deps.findRoadmapProgress(roadmapId), deps.findRoadmapActivity(roadmapId)]);
            return roadmapAnalytics(content?.weeks ?? [], states, activities);
        },
        async openResource(workspaceId: string, roadmapId: string, resourceId: string, userId: string) {
            await resolveResource(workspaceId, roadmapId, resourceId, userId);
            await deps.recordRoadmapResourceOpen(roadmapId, resourceId);
        },
        async resource(workspaceId: string, roadmapId: string, resourceId: string, userId: string) {
            const { resource, source } = await resolveResource(workspaceId, roadmapId, resourceId, userId);
            const metadata = source?.metadata as Record<string, unknown> | null;
            const publicUrl = resource.origin === "web" ? resource.url : source?.url;
            let url: string | undefined;
            if (publicUrl) { try { url = publicWebUrl(publicUrl).href; } catch { /* Extracted text remains available. */ } }
            return {
                id: resource.id, title: resource.title, type: resource.type, origin: resource.origin,
                ...(url ? { url } : {}), ...(source?.content ? { content: source.content } : {}),
                ...(resource.pageNumber ? { pageNumber: resource.pageNumber } : {}),
                ...(resource.timestampSeconds !== undefined ? { timestampSeconds: resource.timestampSeconds } : {}),
                ...(resource.sectionTitle ? { sectionTitle: resource.sectionTitle } : {}),
                ...(typeof metadata?.pageCount === "number" && Number.isInteger(metadata.pageCount) && metadata.pageCount > 0 ? { pageCount: metadata.pageCount } : {}),
                ...(source?.type === "PDF" ? { filePath: deps.resourceFilePath?.(workspaceId, roadmapId, resourceId) ?? `/workspaces/${encodeURIComponent(workspaceId)}/roadmaps/${encodeURIComponent(roadmapId)}/resources/${encodeURIComponent(resourceId)}/file` } : {}),
            };
        },
        async pdf(workspaceId: string, roadmapId: string, resourceId: string, userId: string) {
            const { source } = await resolveResource(workspaceId, roadmapId, resourceId, userId);
            if (!source || source.type !== "PDF") throw new NotFoundError("PDF resource not found");
            return deps.downloadRoadmapPdf(source);
        },
    };
}
export const roadmapService = createRoadmapService();
