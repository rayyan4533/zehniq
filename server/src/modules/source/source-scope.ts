import type { SourceRecord } from "./source.repo.js";

/** Standalone sources have their own index namespace, never a hidden notebook. */
export function sourceIndexNamespace(source: Pick<SourceRecord, "workspaceId" | "collectionId">) {
    if (source.workspaceId && !source.collectionId) return source.workspaceId;
    if (source.collectionId && !source.workspaceId) return `standalone:${source.collectionId}`;
    throw new Error("A source must belong to exactly one notebook or standalone collection");
}
