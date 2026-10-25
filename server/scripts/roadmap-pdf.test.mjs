import assert from "node:assert/strict";
import { test } from "node:test";
process.env.CLOUDINARY_CLOUD_NAME = "testcloud";
const { downloadRoadmapPdf } = await import("../src/modules/roadmap/roadmap-pdf.ts");
test("PDF proxy rejects arbitrary hosts and other clouds before fetching", async (t) => {
    const fetchMock = t.mock.method(globalThis, "fetch", async () => { throw new Error("must not fetch"); });
    for (const fileUrl of ["https://example.com/file.pdf", "https://res.cloudinary.com/another-cloud/raw/file.pdf", "http://res.cloudinary.com/testcloud/raw/file.pdf"])
        await assert.rejects(downloadRoadmapPdf({ metadata: { fileUrl } }), { statusCode: 400 });
    assert.equal(fetchMock.mock.callCount(), 0);
});
test("PDF proxy limits file size, validates signature, and forbids redirects", async (t) => {
    const source = { metadata: { fileUrl: "https://res.cloudinary.com/testcloud/raw/file.pdf" } };
    const fetchMock = t.mock.method(globalThis, "fetch", async (_url, options) => { assert.equal(options.redirect, "error"); assert.ok(options.signal); return new Response("%PDF-1.7\nlocal test fixture"); });
    assert.ok((await downloadRoadmapPdf(source)).subarray(0, 5).equals(Buffer.from("%PDF-")));
    fetchMock.mock.mockImplementation(async () => new Response("not a pdf")); await assert.rejects(downloadRoadmapPdf(source), /not a readable PDF/);
    fetchMock.mock.mockImplementation(async () => new Response("", { headers: { "content-length": String(21 * 1024 * 1024) } })); await assert.rejects(downloadRoadmapPdf(source), /too large/);
});
