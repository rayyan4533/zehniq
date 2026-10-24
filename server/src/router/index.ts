import { chatRoutes } from "../modules/chat/chat.route.js";
import { artifactRoutes } from "../modules/artifact/artifact.route.js";
import type { Express } from "express";
import { memoryRoutes } from "../modules/memory/memory.route.js";
import { sourceRoutes } from "../modules/source/source.route.js";
import { workspaceRoutes } from "../modules/workspace/workspace.route.js";

export function registerRoutes(app: Express): void {
    workspaceRoutes.use("/:workspaceId/sources", sourceRoutes);
    workspaceRoutes.use("/:workspaceId/artifacts", artifactRoutes);
    workspaceRoutes.use("/:workspaceId", chatRoutes);
    app.use("/api/workspaces", workspaceRoutes);
    app.use("/api/memory", memoryRoutes);
}