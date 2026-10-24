import type { Scalars } from "@prisma/orm-postgres/family-contract/types";
import { Temporal } from "temporal-polyfill";
import type { Models } from "../../prisma/contract.d.js";
import { db } from "../../prisma/db.js";

export type ConversationRecord = Scalars<Models.public_Conversation>;

export async function findConversationsByWorkspaceId(workspaceId: string) {
    return await db.orm.public.Conversation.where({ workspaceId })
        .orderBy((conversation) => conversation.updatedAt.desc()).all();
}

export function findConversationById(conversationId: string) {
    return db.orm.public.Conversation.first({ id: conversationId });
}

export function findConversationByIdAndWorkspaceId(conversationId: string, workspaceId: string) {
    return db.orm.public.Conversation.where({ id: conversationId, workspaceId }).first();
}

export function createConversationRecord(workspaceId: string, title?: string) {
    return db.orm.public.Conversation.create({ workspaceId, title: title ?? null });
}

export function updateConversationSummary(
    conversationId: string,
    data: { summary: string; summaryMessageCount: number },
) {
    return db.orm.public.Conversation.where({ id: conversationId }).update({
        ...data,
        summarizedAt: Temporal.Now.instant(),
    });
}

export function updateConversationRecord(conversationId: string, data: { title?: string | null }) {
    return db.orm.public.Conversation.where({ id: conversationId }).update({
        ...(data.title !== undefined ? { title: data.title } : {}),
    });
}

export function touchConversation(conversationId: string) {
    return db.orm.public.Conversation.where({ id: conversationId }).update({
        updatedAt: Temporal.Now.instant(),
    });
}

export async function deleteConversationRecord(conversationId: string) {
    await db.orm.public.Conversation.where({ id: conversationId }).delete();
}
