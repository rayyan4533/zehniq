import { getSignedCloudinaryDownloadUrl } from "../../lib/pdf-cloudinary/cloudinary.js";
import { AppError, ValidationError } from "../../types/app-error.js";
import type { SourceRecord } from "../source/source.repo.js";

const maxPdfBytes = 20 * 1024 * 1024;
function assertCloudinaryUrl(input: string) {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    const url = new URL(input);
    if (!cloudName || url.protocol !== "https:" || url.hostname !== "res.cloudinary.com" || url.username || url.password || url.port || !url.pathname.startsWith(`/${encodeURIComponent(cloudName)}/`)) {
        throw new ValidationError("This PDF has an unavailable storage location. Please upload it again.");
    }
    return url.href;
}
export async function downloadRoadmapPdf(source: SourceRecord): Promise<Buffer> {
    const metadata = source.metadata as Record<string, unknown> | null;
    if (!metadata || typeof metadata.fileUrl !== "string") throw new ValidationError("This PDF has no stored file. Please upload it again.");
    const retrieve = (url: string) => fetch(assertCloudinaryUrl(url), { redirect: "error", signal: AbortSignal.timeout(20_000) });
    let response = await retrieve(metadata.fileUrl);
    if ((response.status === 401 || response.status === 403) && typeof metadata.publicId === "string") {
        await response.body?.cancel();
        const signed = getSignedCloudinaryDownloadUrl(metadata.publicId, metadata.resourceType === "image" ? "image" : "raw");
        if (signed) response = await retrieve(signed);
    }
    if (!response.ok) {
        await response.body?.cancel();
        throw new AppError(422, "The original PDF is unavailable. Check PDF delivery permissions in Cloudinary or upload it again. You can still study its extracted text.");
    }
    if (Number(response.headers.get("content-length")) > maxPdfBytes) {
        await response.body?.cancel();
        throw new ValidationError("This PDF is too large for the embedded viewer.");
    }
    const reader = response.body?.getReader();
    if (!reader) throw new AppError(422, "The PDF file is empty.");
    const pieces: Buffer[] = []; let bytes = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            bytes += value.byteLength;
            if (bytes > maxPdfBytes) throw new ValidationError("This PDF is too large for the embedded viewer.");
            pieces.push(Buffer.from(value));
        }
    } finally { await reader.cancel().catch(() => {}); }
    const file = Buffer.concat(pieces);
    if (!file.subarray(0, 1024).includes(Buffer.from("%PDF-"))) throw new AppError(422, "The stored file is not a readable PDF.");
    return file;
}
