import { Router } from "express";
import { chatController } from "./chat.controller.js";
import { asyncHandler } from "../../utils/async-handler.js";

// Mounted below the authenticated workspace router.
export function createChatRoutes(controller = chatController) {
    const router = Router({ mergeParams: true });
    router.post("/chat", asyncHandler(controller.streamChat));
    router.get("/conversations", asyncHandler(controller.listConversations));
    router.post("/conversations", asyncHandler(controller.createConversation));
    router.get("/conversations/:conversationId/messages", asyncHandler(controller.getMessages));
    router.delete("/conversations/:conversationId", asyncHandler(controller.deleteConversation));
    return router;
}

export const chatRoutes = createChatRoutes();
