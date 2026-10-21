import type { Express } from "express";
// import { memoryRoutes } from "../modules/memory/memory.route.js";
import { sourceRoutes } from "../modules/source/source.route.js";
import { workspaceRoutes } from "../modules/workspace/workspace.route.js";

export function registerRoutes(app: Express): void {
    workspaceRoutes.use("/:workspaceId/sources", sourceRoutes);
    app.use("/api/workspaces", workspaceRoutes);
    // app.use("/api/memory", memoryRoutes);
}