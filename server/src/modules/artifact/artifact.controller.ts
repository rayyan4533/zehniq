import type { Request, Response } from "express";
import * as artifactService from "./artifact.service.js";
import { artifactIdParamSchema, createArtifactSchema } from "./artifact.validator.js";
import { workspaceIdParamSchema } from "../workspace/workspace.validator.js";

export function createArtifactController(service = artifactService) {
    return {
        async listArtifacts(req: Request, res: Response) {
            const { workspaceId } = workspaceIdParamSchema.parse(req.params);
            res.json(await service.listArtifactsForWorkspace(workspaceId, req.session.user.id));
        },
        async createArtifact(req: Request, res: Response) {
            const { workspaceId } = workspaceIdParamSchema.parse(req.params);
            const input = createArtifactSchema.parse(req.body);
            res.status(201).json(await service.createArtifactForWorkspace(workspaceId, req.session.user.id, input));
        },
        async getArtifact(req: Request, res: Response) {
            const { workspaceId, artifactId } = artifactIdParamSchema.parse(req.params);
            res.json(await service.getArtifactForWorkspace(workspaceId, artifactId, req.session.user.id));
        },
        async deleteArtifact(req: Request, res: Response) {
            const { workspaceId, artifactId } = artifactIdParamSchema.parse(req.params);
            await service.deleteArtifactForWorkspace(workspaceId, artifactId, req.session.user.id);
            res.status(204).send();
        },
    };
}

export const artifactController = createArtifactController();
