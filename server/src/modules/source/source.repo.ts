import type { Scalars } from "@prisma/orm-postgres/family-contract/types";
import type { Models } from "../../prisma/contract.d.js";
import { or } from "@prisma/orm-postgres/orm-client";
import { NotFoundError } from "../../types/app-error.js";
import { db } from "../../prisma/db.js";
import type { ListSourcesQuery } from "./source.validator.js";

export const sourceSelect = {
    id: true,
    workspaceId: true,
    type: true,
    title: true,
    content: true,
    url: true,
    status: true,
    metadata: true,
    createdAt: true,
    updatedAt: true,
} as const;

export type SourceType = "PDF" | "WEBSITE" | "YOUTUBE" | "TEXT" | "MARKDOWN";
export type SourceStatus = "PENDING" | "PROCESSING" | "READY" | "FAILED";

export type SourceRecord = Scalars<Models.public_Source>;

export type CreateSourceData = {
    workspaceId?: string;
    collectionId?: string;
    type: SourceType;
    title: string;
    content?: string | null;
    url?: string | null;
    status?: SourceStatus;
    metadata?: SourceRecord["metadata"];
};

export type UpdateSourceData = {
    content?: string | null;
    status?: SourceStatus;
    metadata?: SourceRecord["metadata"];
};

export async function createSourceRecord(data: CreateSourceData): Promise<SourceRecord> {
    if (!!data.workspaceId === !!data.collectionId) throw new Error("A source must belong to exactly one notebook or standalone collection");
    const row = await db.orm.public.Source
        .select(
            "id",
            "workspaceId",
            "collectionId",
            "type",
            "title",
            "content",
            "url",
            "status",
            "metadata",
            "createdAt",
            "updatedAt",
        )
        .create({
            ...(data.workspaceId ? { workspaceId: data.workspaceId } : {}),
            ...(data.collectionId ? { collectionId: data.collectionId } : {}),
            type: data.type,
            title: data.title,
            ...(data.content !== undefined ? { content: data.content } : {}),
            ...(data.url !== undefined ? { url: data.url } : {}),
            ...(data.status !== undefined ? { status: data.status } : {}),
            ...(data.metadata !== undefined ? { metadata: data.metadata } : {}),
        });

    return row;
}

export async function findSourcesByWorkspaceId(
    workspaceId: string,
    filters: ListSourcesQuery = {},
): Promise<SourceRecord[]> {
    let query = db.orm.public.Source
        .where({ workspaceId })
        .select(
            "id",
            "workspaceId",
            "collectionId",
            "type",
            "title",
            "content",
            "url",
            "status",
            "metadata",
            "createdAt",
            "updatedAt",
        );

    if (filters.type) {
        query = query.where({ type: filters.type });
    }

    if (filters.status) {
        query = query.where({ status: filters.status });
    }

    if (filters.q) {
        const searchTerm = `%${filters.q}%`;
        query = query.where((s) => or(s.title.ilike(searchTerm), s.content.ilike(searchTerm)));
    }

    const rows = await query.orderBy((s) => s.createdAt.desc()).all();
    return rows;
}

export async function findSourceByIdAndWorkspaceId(
    sourceId: string,
    workspaceId: string,
): Promise<SourceRecord | null> {
    const row = await db.orm.public.Source
        .where({ id: sourceId, workspaceId })
        .select(
            "id",
            "workspaceId",
            "collectionId",
            "type",
            "title",
            "content",
            "url",
            "status",
            "metadata",
            "createdAt",
            "updatedAt",
        )
        .first();

    return row;
}

export async function findSourceById(sourceId: string): Promise<SourceRecord | null> {
    const row = await db.orm.public.Source
        .where({ id: sourceId })
        .select(
            "id",
            "workspaceId",
            "collectionId",
            "type",
            "title",
            "content",
            "url",
            "status",
            "metadata",
            "createdAt",
            "updatedAt",
        )
        .first();

    return row;
}

export async function updateSourceRecord(
    sourceId: string,
    data: UpdateSourceData,
): Promise<SourceRecord> {
    const updatePayload: UpdateSourceData = {};
    if (data.content !== undefined) updatePayload.content = data.content;
    if (data.status !== undefined) updatePayload.status = data.status;
    if (data.metadata !== undefined) updatePayload.metadata = data.metadata;

    const row = await db.orm.public.Source
        .where({ id: sourceId })
        .select(
            "id",
            "workspaceId",
            "collectionId",
            "type",
            "title",
            "content",
            "url",
            "status",
            "metadata",
            "createdAt",
            "updatedAt",
        )
        .update(updatePayload);

    if (!row) throw new NotFoundError("Source not found");
    return row;
}

export async function deleteSourceRecord(sourceId: string): Promise<void> {
    await db.orm.public.Source.where({ id: sourceId }).delete();
}