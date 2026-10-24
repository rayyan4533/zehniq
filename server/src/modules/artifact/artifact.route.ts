import { Router } from "express";
import { artifactController } from "./artifact.controller.js";
import { asyncHandler } from "../../utils/async-handler.js";

// Mounted below the authenticated workspace router.
export function createArtifactRoutes(controller = artifactController) {
    const router = Router({ mergeParams: true });
    router.get("/", asyncHandler(controller.listArtifacts));
    router.post("/", asyncHandler(controller.createArtifact));
    router.get("/:artifactId", asyncHandler(controller.getArtifact));
    router.delete("/:artifactId", asyncHandler(controller.deleteArtifact));
    return router;
}

export const artifactRoutes = createArtifactRoutes();
