import { db } from "../../prisma/db.js";
import type {
    CreateWorkspaceInput,
    UpdateWorkspaceInput,
} from "./workspace.validator.js";

export type WorkspaceRecord = {
    id: string;
    title: string;
    description: string | null;
    icon: string | null;
    defaultModel: string;
    createdAt: Date;
    updatedAt: Date;
};

export async function findWorkspacesByUserId(userId: string) {
    return await db.orm.public.Workspace
        .where({ userId })
        .select("id", "title", "description", "icon", "defaultModel", "createdAt", "updatedAt")
        .orderBy((w) => w.updatedAt.desc())
        .all();
}

export async function findWorkspaceByIdAndUserId(
    workspaceId: string,
    userId: string,
) {
    return await db.orm.public.Workspace
        .where({ id: workspaceId, userId })
        .select("id", "title", "description", "icon", "defaultModel", "createdAt", "updatedAt")
        .first();
}

export async function createWorkspaceRecord(
    userId: string,
    data: CreateWorkspaceInput,
) {
    return await db.orm.public.Workspace
        .select("id", "title", "description", "icon", "defaultModel", "createdAt", "updatedAt")
        .create({
            userId,
            title: data.title,
            ...(data.description !== undefined ? { description: data.description } : {}),
            ...(data.icon !== undefined ? { icon: data.icon } : {}),
            ...(data.defaultModel !== undefined ? { defaultModel: data.defaultModel } : {}),
        });
}

export async function updateWorkspaceRecord(
    workspaceId: string,
    data: UpdateWorkspaceInput,
) {
    const updateData: {
        title?: string;
        description?: string;
        icon?: string;
        defaultModel?: "gpt-4o-mini" | "gpt-4o";
    } = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.icon !== undefined) updateData.icon = data.icon;
    if (data.defaultModel !== undefined) updateData.defaultModel = data.defaultModel;

    return await db.orm.public.Workspace
        .where({ id: workspaceId })
        .select("id", "title", "description", "icon", "defaultModel", "createdAt", "updatedAt")
        .update(updateData);
}

export async function deleteWorkspaceRecord(workspaceId: string) {
    await db.orm.public.Workspace.where({ id: workspaceId }).delete();
}
