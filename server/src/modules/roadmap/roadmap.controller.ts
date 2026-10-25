import type { Request, Response } from "express";
import { z } from "zod";
import { roadmapService, createRoadmapSchema, renameRoadmapSchema, taskProgressSchema } from "./roadmap.service.js";

const paramsSchema = z.object({ workspaceId: z.string().trim().min(1).max(160), roadmapId: z.string().trim().min(1).max(160).optional(), taskId: z.string().trim().min(1).max(160).optional(), resourceId: z.string().trim().min(1).max(160).optional() });
export function createRoadmapController(service = roadmapService) {
    const params = (req: Request) => paramsSchema.parse(req.params);
    return {
        async list(req: Request, res: Response) { res.json(await service.list(params(req).workspaceId, req.session.user.id)); },
        async create(req: Request, res: Response) { res.status(202).json(await service.create(params(req).workspaceId, req.session.user.id, createRoadmapSchema.parse(req.body))); },
        async get(req: Request, res: Response) { const p = params(req); res.json(await service.get(p.workspaceId, p.roadmapId!, req.session.user.id)); },
        async rename(req: Request, res: Response) { const p = params(req); res.json(await service.rename(p.workspaceId, p.roadmapId!, req.session.user.id, renameRoadmapSchema.parse(req.body))); },
        async remove(req: Request, res: Response) { const p = params(req); await service.remove(p.workspaceId, p.roadmapId!, req.session.user.id); res.status(204).end(); },
        async retry(req: Request, res: Response) { const p = params(req); res.status(202).json(await service.retry(p.workspaceId, p.roadmapId!, req.session.user.id)); },
        async setTask(req: Request, res: Response) { const p = params(req); res.json(await service.setTask(p.workspaceId, p.roadmapId!, p.taskId!, req.session.user.id, taskProgressSchema.parse(req.body))); },
        async analytics(req: Request, res: Response) { const p = params(req); res.json(await service.analytics(p.workspaceId, p.roadmapId!, req.session.user.id)); },
        async resource(req: Request, res: Response) { const p = params(req); res.json(await service.resource(p.workspaceId, p.roadmapId!, p.resourceId!, req.session.user.id)); },
        async openResource(req: Request, res: Response) { const p = params(req); await service.openResource(p.workspaceId, p.roadmapId!, p.resourceId!, req.session.user.id); res.status(204).end(); },
        async pdf(req: Request, res: Response) {
            const p = params(req); const file = await service.pdf(p.workspaceId, p.roadmapId!, p.resourceId!, req.session.user.id);
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", 'inline; filename="document.pdf"');
            res.setHeader("Cache-Control", "private, no-store");
            res.setHeader("X-Content-Type-Options", "nosniff");
            res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
            res.setHeader("Content-Security-Policy", "frame-ancestors 'self'");
            res.send(file);
        },
    };
}
export const roadmapController = createRoadmapController();
