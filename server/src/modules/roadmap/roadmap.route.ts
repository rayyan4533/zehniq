import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { createRoadmapController } from "./roadmap.controller.js";

export function createRoadmapRoutes(controller = createRoadmapController()) {
    const router = Router({ mergeParams: true });
    router.get("/", asyncHandler(controller.list));
    router.post("/", asyncHandler(controller.create));
    router.get("/:roadmapId", asyncHandler(controller.get));
    router.patch("/:roadmapId", asyncHandler(controller.rename));
    router.delete("/:roadmapId", asyncHandler(controller.remove));
    router.post("/:roadmapId/retry", asyncHandler(controller.retry));
    router.patch("/:roadmapId/tasks/:taskId", asyncHandler(controller.setTask));
    router.get("/:roadmapId/analytics", asyncHandler(controller.analytics));
    router.get("/:roadmapId/resources/:resourceId", asyncHandler(controller.resource));
    router.post("/:roadmapId/resources/:resourceId/open", asyncHandler(controller.openResource));
    router.get("/:roadmapId/resources/:resourceId/file", asyncHandler(controller.pdf));
    return router;
}
export const roadmapRoutes = createRoadmapRoutes();
