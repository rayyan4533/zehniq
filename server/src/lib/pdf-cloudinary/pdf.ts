import { extractText, getDocumentProxy } from "unpdf";
import { getSignedCloudinaryDownloadUrl } from "./cloudinary.js";

export type PdfExtractResult = {
    text: string;
    pages: string[];
    pageCount: number;
};

class PdfDownloadError extends Error {
    constructor(readonly status: number) {
        super(status === 401 || status === 403
            ? "Cloudinary blocked access to this PDF. Check the product environment’s Security settings for PDF delivery and the asset’s access permissions."
            : "The stored PDF could not be downloaded. Please try uploading it again.");
    }
}

async function downloadPdf(url: string) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new PdfDownloadError(response.status);
    }

    return response.arrayBuffer();
}

export async function extractPdfFromBuffer(
    buffer: ArrayBuffer | Buffer,
): Promise<PdfExtractResult> {
    const arrayBuffer =
        buffer instanceof Buffer
            ? (buffer.buffer.slice(
                  buffer.byteOffset,
                  buffer.byteOffset + buffer.byteLength,
              ) as ArrayBuffer)
            : buffer;

    const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer));
    const { totalPages, text } = await extractText(pdf, { mergePages: false });

    const pages = Array.isArray(text)
        ? text.map((page) => page.trim())
        : [String(text).trim()];

    const joined = pages.filter(Boolean).join("\n\n");

    if (!joined) {
        throw new Error("No text could be extracted from the PDF");
    }

    return {
        text: joined,
        pages,
        pageCount: totalPages,
    };
}

export async function extractPdfFromCloudinary(input: {
    fileUrl: string;
    publicId?: string | undefined;
    resourceType?: "raw" | "image" | undefined;
}): Promise<PdfExtractResult> {
    try {
        const buffer = await downloadPdf(input.fileUrl);
        return await extractPdfFromBuffer(buffer);
    } catch (error) {
        const isUnauthorized =
            error instanceof PdfDownloadError && (error.status === 401 || error.status === 403);

        if (!isUnauthorized || !input.publicId) {
            throw error;
        }

        const signedUrl = getSignedCloudinaryDownloadUrl(
            input.publicId,
            input.resourceType ?? "raw",
        );

        if (!signedUrl) {
            throw new Error(
                "PDF download requires authentication. Add CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to server/.env, or re-upload the PDF.",
            );
        }

        const buffer = await downloadPdf(signedUrl);
        return extractPdfFromBuffer(buffer);
    }
}
