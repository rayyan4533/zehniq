import type { Scalars } from "@prisma/orm-postgres/family-contract/types";
import type { Models } from "../../prisma/contract.d.js";
import { db } from "../../prisma/db.js";

export type MessageRecord = Scalars<Models.public_Message>;
export type CreateMessageData = {
    conversationId: string;
    role: MessageRecord["role"];
    content: string;
    citations?: MessageRecord["citations"];
};

export async function findMessagesByConversationId(conversationId: string) {
    return await db.orm.public.Message.where({ conversationId })
        .orderBy((message) => message.createdAt.asc()).all();
}

export async function countMessagesByConversationId(conversationId: string) {
    const result = await db.orm.public.Message.where({ conversationId })
        .aggregate((aggregate) => ({ count: aggregate.count() }));
    return result.count;
}

export function createMessageRecord(data: CreateMessageData) {
    return db.orm.public.Message.create({
        conversationId: data.conversationId,
        role: data.role,
        content: data.content,
        ...(data.citations !== undefined ? { citations: data.citations } : {}),
    });
}
