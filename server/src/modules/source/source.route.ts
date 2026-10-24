import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import {
    bulkDeleteSources,
    retrySource,
    createSource,
    deleteSource,
    getSource,
    importWebsite,
    importYoutube,
    listSources,
    uploadPdf,
} from "./source.controller.js";
import { uploadSinglePdf } from "./source-upload.middleware.js";

export const sourceRoutes = Router({ mergeParams: true });

sourceRoutes.post(
    "/upload",
    uploadSinglePdf,
    asyncHandler(uploadPdf),
);
sourceRoutes.post("/import/website", asyncHandler(importWebsite));
sourceRoutes.post("/import/youtube", asyncHandler(importYoutube));
sourceRoutes.get("/", asyncHandler(listSources));
sourceRoutes.post("/", asyncHandler(createSource));
sourceRoutes.post("/bulk-delete", asyncHandler(bulkDeleteSources));
sourceRoutes.get("/:sourceId", asyncHandler(getSource));
sourceRoutes.post("/:sourceId/retry", asyncHandler(retrySource));
sourceRoutes.delete("/:sourceId", asyncHandler(deleteSource));
