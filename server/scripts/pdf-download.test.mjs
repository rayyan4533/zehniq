import assert from "node:assert/strict";
import { test } from "node:test";
import { extractPdfFromCloudinary } from "../src/lib/pdf-cloudinary/pdf.ts";

test("PDF access denials explain the delivery restriction without displaying a status code", async (t) => {
    for (const status of [401, 403]) {
        const fetchMock = t.mock.method(globalThis, "fetch", async () => new Response(null, { status }));
        await assert.rejects(extractPdfFromCloudinary({ fileUrl: "https://example.com/file.pdf" }), (error) => {
            assert.match(error.message, /Cloudinary blocked access/);
            assert.doesNotMatch(error.message, /401|403/);
            return true;
        });
        fetchMock.mock.restore();
    }
});

test("a missing stored PDF suggests re-uploading", async (t) => {
    t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 404 }));
    await assert.rejects(extractPdfFromCloudinary({ fileUrl: "https://example.com/file.pdf" }), /try uploading it again/);
});
