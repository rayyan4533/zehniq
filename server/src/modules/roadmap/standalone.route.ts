import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { uploadSinglePdf } from "../source/source-upload.middleware.js";
import { createRoadmapController } from "./roadmap.controller.js";
import { createRoadmapRoutes } from "./roadmap.route.js";
import * as repo from "./standalone.repo.js";
import * as service from "./standalone.service.js";

export const standaloneRoutes = Router();
standaloneRoutes.use(requireAuth);
standaloneRoutes.get("/", asyncHandler(async (req, res) => { res.json(await service.getCollections(req.session.user.id)); }));
standaloneRoutes.post("/", asyncHandler(async (req, res) => { const input = service.collectionInput.parse(req.body ?? {}); res.status(201).json(await repo.createCollection(req.session.user.id, input.title)); }));
// workspaceId is the shared router's parameter name only. Its value is a
// standalone collection ID and every lookup below uses collection ownership.
standaloneRoutes.get("/:workspaceId", asyncHandler(async (req, res) => { res.json(await service.getCollection(String(req.params.workspaceId), req.session.user.id)); }));
standaloneRoutes.patch("/:workspaceId", asyncHandler(async (req, res) => {
    const id = String(req.params.workspaceId); await service.requireCollection(id, req.session.user.id);
    const input = service.collectionInput.parse(req.body); res.json(await repo.renameCollection(id, input.title));
}));
standaloneRoutes.delete("/:workspaceId", asyncHandler(async (req, res) => { await service.removeCollection(String(req.params.workspaceId), req.session.user.id); res.status(204).end(); }));
standaloneRoutes.get("/:workspaceId/sources", asyncHandler(async (req, res) => { const collection = await service.getCollection(String(req.params.workspaceId), req.session.user.id); res.json(collection.sources); }));
standaloneRoutes.post("/:workspaceId/sources", asyncHandler(async (req, res) => { res.status(201).json(await service.addCollectionSource(String(req.params.workspaceId), req.session.user.id, "text", req.body)); }));
standaloneRoutes.post("/:workspaceId/sources/import/website", asyncHandler(async (req, res) => { res.status(201).json(await service.addCollectionSource(String(req.params.workspaceId), req.session.user.id, "website", req.body)); }));
standaloneRoutes.post("/:workspaceId/sources/import/youtube", asyncHandler(async (req, res) => { res.status(201).json(await service.addCollectionSource(String(req.params.workspaceId), req.session.user.id, "youtube", req.body)); }));
standaloneRoutes.post("/:workspaceId/sources/upload", uploadSinglePdf, asyncHandler(async (req, res) => { res.status(201).json(await service.uploadCollectionPdf(String(req.params.workspaceId), req.session.user.id, req.file, typeof req.body?.title === "string" ? req.body.title : undefined)); }));
standaloneRoutes.delete("/:workspaceId/sources/:sourceId", asyncHandler(async (req, res) => { await service.removeCollectionSource(String(req.params.workspaceId), String(req.params.sourceId), req.session.user.id); res.status(204).end(); }));
const controller = createRoadmapController(service.standaloneRoadmapService);
standaloneRoutes.use("/:workspaceId/roadmaps", createRoadmapRoutes({
    ...controller,
    async create(req, res) { res.status(202).json(await service.createStandaloneRoadmap(String(req.params.workspaceId), req.session.user.id, req.body)); },
}));
