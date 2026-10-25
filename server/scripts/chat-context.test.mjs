import assert from "node:assert/strict";
import { test } from "node:test";
process.env.DATABASE_URL ??= "postgresql://localhost/notebook_test";
const { createWorkspaceContextRetriever, buildChatSystemPrompt } = await import("../src/modules/chat/chat-context.service.ts");

const sources = [
    { id: "site", title: "Website", type: "WEBSITE" },
    { id: "video", title: "Lecture", type: "YOUTUBE" },
];
function setup(matches = []) {
    const calls = [];
    const retrieve = createWorkspaceContextRetriever({
        findSourcesByWorkspaceId: async () => sources,
        findChunksBySourceId: async (sourceId) => Array.from({ length: 5 }, (_, index) => ({ id: `${sourceId}-${index}`, index, content: `${sourceId} excerpt ${index}`, metadata: {} })),
        embedTexts: async () => { calls.push("embed"); return [[1, 2]]; },
        queryWorkspaceVectors: async (_workspace, _vector, _topK, sourceIds) => { calls.push(sourceIds); return matches; },
    });
    return { retrieve, calls };
}

test("broad questions retain every selected source when all scores miss the cutoff", async () => {
    const { retrieve } = setup([{ score: 0.34, metadata: { sourceId: "site" } }]);
    const chunks = await retrieve("workspace", "summarize each source", ["site", "video"]);
    assert.deepEqual(new Set(chunks.map((chunk) => chunk.sourceId)), new Set(["site", "video"]));
    assert.equal(chunks.find((chunk) => chunk.sourceId === "video").sourceType, "YOUTUBE");
    assert.deepEqual(chunks.filter((chunk) => chunk.sourceId === "video").map((chunk) => chunk.chunkIndex), [0, 2, 4]);
    const prompt = buildChatSystemPrompt({ chunks });
    assert.match(prompt, /Lecture \(YOUTUBE\)/);
    assert.match(prompt, /already extracted/);
    assert.doesNotMatch(prompt, /No source excerpts were supplied/);
});

test("selection restricts retrieval and source samples even if Pinecone returns an unrelated match", async () => {
    const { retrieve, calls } = setup([{ score: 0.9, metadata: { sourceId: "site", sourceTitle: "Website", sourceType: "WEBSITE", chunkId: "site-0", text: "unselected" } }]);
    const chunks = await retrieve("workspace", "what is my video about", ["video"]);
    assert.ok(chunks.every((chunk) => chunk.sourceId === "video"));
    assert.deepEqual(calls[1], ["video"]);
});

test("empty selections avoid retrieval and foreign or unavailable IDs are rejected", async () => {
    const { retrieve, calls } = setup();
    assert.deepEqual(await retrieve("workspace", "hello", []), []);
    assert.deepEqual(calls, []);
    await assert.rejects(retrieve("workspace", "hello", ["someone-elses-source"]), { statusCode: 400 });
    assert.deepEqual(calls, []);
});

test("semantic matches keep their score and do not duplicate overview chunks", async () => {
    const { retrieve } = setup([{ score: 0.9, metadata: { sourceId: "video", sourceTitle: "Lecture", sourceType: "YOUTUBE", chunkId: "video-0", chunkIndex: 0, text: "Relevant transcript" } }]);
    const chunks = await retrieve("workspace", "specific topic", ["video"]);
    assert.equal(chunks.filter((chunk) => chunk.chunkId === "video-0").length, 1);
    assert.equal(chunks[0].score, 0.9);
});
