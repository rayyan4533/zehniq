import type { Request, Response } from "express";
import { safeValidateUIMessages } from "ai";
import * as chatService from "./chat.service.js";
import { chatBodySchema, conversationIdParamSchema, createConversationSchema } from "./chat.validator.js";
import { workspaceIdParamSchema } from "../workspace/workspace.validator.js";
import { ValidationError } from "../../types/app-error.js";
import { getTextFromUIMessage } from "./chat-message.js";

export function createChatController(service = chatService) {
    return {
        async streamChat(req: Request, res: Response) {
            const { workspaceId } = workspaceIdParamSchema.parse(req.params);
            const input = chatBodySchema.parse(req.body);
            const messages = await safeValidateUIMessages({ messages: input.messages });
            if (!messages.success) throw new ValidationError("Invalid chat messages");
            if (messages.data.some((message) => message.role === "system")) {
                throw new ValidationError("System messages cannot be supplied by the client");
            }
            if (messages.data.at(-1)?.role !== "user") {
                throw new ValidationError("The last message must be a user message");
            }
            if (!getTextFromUIMessage(messages.data.at(-1)!).trim()) {
                throw new ValidationError("A user message is required");
            }
            await service.streamWorkspaceChat(res, workspaceId, req.session.user.id, {
                messages: messages.data,
                ...(input.conversationId !== undefined ? { conversationId: input.conversationId } : {}),
                ...(input.model !== undefined ? { model: input.model } : {}),
                ...(input.webSearch !== undefined ? { webSearch: input.webSearch } : {}),
                ...(input.sourceIds !== undefined ? { sourceIds: input.sourceIds } : {}),
            });
        },
        async listConversations(req: Request, res: Response) {
            const { workspaceId } = workspaceIdParamSchema.parse(req.params);
            res.json(await service.listConversationsForWorkspace(workspaceId, req.session.user.id));
        },
        async createConversation(req: Request, res: Response) {
            const { workspaceId } = workspaceIdParamSchema.parse(req.params);
            const input = createConversationSchema.parse(req.body ?? {});
            res.status(201).json(await service.createConversationForWorkspace(workspaceId, req.session.user.id, input.title));
        },
        async getMessages(req: Request, res: Response) {
            const { workspaceId, conversationId } = conversationIdParamSchema.parse(req.params);
            res.json(await service.getConversationMessagesForWorkspace(workspaceId, conversationId, req.session.user.id));
        },
        async deleteConversation(req: Request, res: Response) {
            const { workspaceId, conversationId } = conversationIdParamSchema.parse(req.params);
            await service.deleteConversationForWorkspace(workspaceId, conversationId, req.session.user.id);
            res.status(204).send();
        },
    };
}

export const chatController = createChatController();
