import type { Scalars } from "@prisma/orm-postgres/family-contract/types";
import type { Models } from "../../prisma/contract.d.js";
import { db } from "../../prisma/db.js";

export const sourceChunkSelect = {
    id: true,
    sourceId: true,
    index: true,
    content: true,
    tokenCount: true,
    metadata: true,
    createdAt: true,
} as const;

export type SourceChunkRecord = Scalars<Models.public_SourceChunk>;

export type CreateSourceChunkData = {
    sourceId: string;
    index: number;
    content: string;
    tokenCount?: number | null;
    metadata?: SourceChunkRecord["metadata"];
};

export async function deleteChunksBySourceId(sourceId: string) {
    return await db.orm.public.SourceChunk
        .where({ sourceId })
        .deleteAll();
}

export async function createSourceChunks(
    chunks: CreateSourceChunkData[],
): Promise<SourceChunkRecord[]> {
    if (chunks.length === 0) {
        return [];
    }

    return await db.transaction(async (tx) => {
        const createdChunks: SourceChunkRecord[] = [];
        for (const chunk of chunks) {
            const row = await tx.orm.public.SourceChunk
                .select(
                    "id",
                    "sourceId",
                    "index",
                    "content",
                    "tokenCount",
                    "metadata",
                    "createdAt",
                )
                .create({
                    sourceId: chunk.sourceId,
                    index: chunk.index,
                    content: chunk.content,
                    ...(chunk.tokenCount !== undefined && chunk.tokenCount !== null
                        ? { tokenCount: chunk.tokenCount }
                        : {}),
                    ...(chunk.metadata !== undefined
                        ? { metadata: chunk.metadata }
                        : {}),
                });
            createdChunks.push(row);
        }
        return createdChunks;
    });
}

export async function findChunksBySourceId(
    sourceId: string,
): Promise<SourceChunkRecord[]> {
    const rows = await db.orm.public.SourceChunk
        .where({ sourceId })
        .select(
            "id",
            "sourceId",
            "index",
            "content",
            "tokenCount",
            "metadata",
            "createdAt",
        )
        .orderBy((c) => c.index.asc())
        .all();

    return rows;
}
