import { Temporal } from "temporal-polyfill";
import type { Scalars } from "@prisma/orm-postgres/family-contract/types";
import type { Models } from "../../prisma/contract.d.js";
import { db } from "../../prisma/db.js";
import { ConflictError, NotFoundError } from "../../types/app-error.js";

export type RoadmapRecord = Scalars<Models.public_LearningRoadmap>;
export type RoadmapProgressRecord = Scalars<Models.public_RoadmapTaskProgress>;
export type RoadmapActivityRecord = Scalars<Models.public_RoadmapActivity>;

export function findRoadmapsByWorkspaceId(workspaceId: string) {
    return db.orm.public.LearningRoadmap.where({ workspaceId }).orderBy((row) => row.createdAt.desc()).all();
}
export function findRoadmapById(id: string) { return db.orm.public.LearningRoadmap.where({ id }).first(); }
export function findRoadmapByIdAndWorkspaceId(id: string, workspaceId: string) { return db.orm.public.LearningRoadmap.where({ id, workspaceId }).first(); }
export function createRoadmapRecord(input: { workspaceId: string; title: string; durationMonths: number; sourceIds: string[] }) {
    return db.orm.public.LearningRoadmap.create({ ...input, status: "generating", phase: "analyzing" });
}
export function updateRoadmapRecord(id: string, input: { title?: string; status?: string; phase?: string; content?: unknown; analysis?: unknown; limitations?: unknown; generationError?: string | null }) {
    const json = (value: unknown): RoadmapRecord["content"] => value == null ? null : JSON.parse(JSON.stringify(value));
    return db.orm.public.LearningRoadmap.where({ id }).update({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.phase !== undefined ? { phase: input.phase } : {}),
        ...(input.content !== undefined ? { content: json(input.content) } : {}),
        ...(input.analysis !== undefined ? { analysis: json(input.analysis) } : {}),
        ...(input.limitations !== undefined ? { limitations: json(input.limitations) } : {}),
        ...(input.generationError !== undefined ? { generationError: input.generationError } : {}),
    });
}
export async function deleteRoadmapRecord(id: string) { await db.orm.public.LearningRoadmap.where({ id }).delete(); }
export function claimRoadmapRetry(id: string) {
    return db.orm.public.LearningRoadmap.where({ id, status: "failed" }).update({ status: "generating", phase: "analyzing", generationError: null });
}
export function findRoadmapProgress(roadmapId: string) { return db.orm.public.RoadmapTaskProgress.where({ roadmapId }).all(); }
export function findRoadmapActivity(roadmapId: string) { return db.orm.public.RoadmapActivity.where({ roadmapId }).orderBy((row) => row.createdAt.asc()).all(); }

/** Lock the parent row before changing progress so simultaneous toggles remain atomic. */
export async function setRoadmapTaskProgress(roadmapId: string, taskId: string, isCompleted: boolean) {
    await db.transaction(async (tx) => {
        const locked = await tx.orm.public.LearningRoadmap.where({ id: roadmapId, status: "ready" }).update({ status: "ready" });
        if (!locked) throw new ConflictError("This roadmap is not ready to track progress.");
        const existing = await tx.orm.public.RoadmapTaskProgress.where({ roadmapId, taskId }).first();
        if ((existing?.isCompleted ?? false) === isCompleted) return;
        const completedAt = isCompleted ? Temporal.Now.instant() : null;
        if (existing) await tx.orm.public.RoadmapTaskProgress.where({ id: existing.id }).update({ isCompleted, completedAt });
        else await tx.orm.public.RoadmapTaskProgress.create({ roadmapId, taskId, isCompleted, completedAt });
        await tx.orm.public.RoadmapActivity.create({ roadmapId, taskId, kind: isCompleted ? "task_completed" : "task_reopened" });
    });
}
export async function recordRoadmapResourceOpen(roadmapId: string, resourceId: string) {
    const roadmap = await findRoadmapById(roadmapId);
    if (!roadmap) throw new NotFoundError("Roadmap not found");
    await db.orm.public.RoadmapActivity.create({ roadmapId, resourceId, kind: "resource_opened" });
}
