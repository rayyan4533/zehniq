import type { Scalars } from "@prisma/orm-postgres/family-contract/types";
import type { Models } from "../../prisma/contract.d.js";
import { db } from "../../prisma/db.js";

export type ArtifactRecord = Scalars<Models.public_LearningArtifact>;
export type CreateArtifactData = {
    workspaceId: string;
    type: ArtifactRecord["type"];
    title: string;
    sourceIds: readonly string[];
    status?: ArtifactRecord["status"];
    metadata?: ArtifactRecord["metadata"];
};

export async function findArtifactsByWorkspaceId(workspaceId: string) {
    return await db.orm.public.LearningArtifact.where({ workspaceId })
        .orderBy((artifact) => artifact.createdAt.desc()).all();
}

export function findArtifactByIdAndWorkspaceId(artifactId: string, workspaceId: string) {
    return db.orm.public.LearningArtifact.where({ id: artifactId, workspaceId }).first();
}

export function createArtifactRecord(data: CreateArtifactData) {
    return db.orm.public.LearningArtifact.create({
        workspaceId: data.workspaceId,
        type: data.type,
        title: data.title,
        sourceIds: [...data.sourceIds],
        status: data.status ?? "PENDING",
        ...(data.metadata !== undefined ? { metadata: data.metadata } : {}),
    });
}

export function updateArtifactRecord(
    artifactId: string,
    data: {
        title?: string;
        content?: ArtifactRecord["content"];
        status?: ArtifactRecord["status"];
        metadata?: ArtifactRecord["metadata"];
    },
) {
    return db.orm.public.LearningArtifact.where({ id: artifactId }).update({
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.content !== undefined ? { content: data.content } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.metadata !== undefined ? { metadata: data.metadata } : {}),
    });
}

export async function deleteArtifactRecord(artifactId: string) {
    await db.orm.public.LearningArtifact.where({ id: artifactId }).delete();
}

export function findArtifactById(artifactId: string) {
    return db.orm.public.LearningArtifact.first({ id: artifactId });
}
