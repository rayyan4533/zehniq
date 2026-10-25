import assert from "node:assert/strict";
import { test } from "node:test";

// No requests or telemetry leave the process during these tests.
process.env.MEM0_TELEMETRY = "false";
process.env.MEM0_API_KEY = "local-test-key";
const { MemoryClient } = await import("mem0ai");
const { addUserMemory, addMemoriesFromMessages, getMem0Client } = await import("../src/lib/mem0.ts");
const { updateMemoryForUser, deleteMemoryForUser } = await import("../src/modules/memory/memory.service.ts");

test("Mem0 integration", async (t) => {
    t.mock.method(MemoryClient.prototype, "ping", async () => ({}));
    const client = getMem0Client();
    await client.initialized;

    await t.test("automatic extraction sends only user messages and skips assistant-only exchanges", async (t) => {
        const add = t.mock.method(client, "add", async () => ({}));
        const userMessage = { role: "user", content: "I prefer short examples" };
        await addMemoriesFromMessages("alice", [userMessage, { role: "assistant", content: "An assistant assumption" }], { source: "learned" });
        assert.deepEqual(add.mock.calls[0].arguments, [[userMessage], { userId: "alice", infer: true, metadata: { source: "learned" } }]);
        await addMemoriesFromMessages("alice", [{ role: "assistant", content: "An assistant assumption" }]);
        await addMemoriesFromMessages("alice", []);
        assert.equal(add.mock.callCount(), 1);
    });

    await t.test("manual creation accepts the v3 envelope and reloads the full record", async (t) => {
        const add = t.mock.method(client, "add", async () => ({
            status: "SUCCESS", results: [{ id: "memory-1", data: { memory: "Short examples" } }],
        }));
        t.mock.method(client, "get", async () => ({
            id: "memory-1", userId: "alice", memory: "Short examples", metadata: { source: "manual" },
        }));
        const memory = await addUserMemory("alice", { memory: "Short examples", infer: false });
        assert.equal(memory.memory, "Short examples");
        assert.equal(memory.source, "manual");
        assert.equal(add.mock.calls[0].arguments[1].userId, "alice");
        assert.equal(add.mock.calls[0].arguments[1].infer, false);
    });

    await t.test("another user's memory cannot be updated or deleted", async (t) => {
        t.mock.method(client, "get", async () => ({ id: "memory-1", userId: "bob" }));
        const update = t.mock.method(client, "update", async () => ({}));
        const remove = t.mock.method(client, "delete", async () => ({}));
        await assert.rejects(updateMemoryForUser("alice", "memory-1", { memory: "changed" }), { statusCode: 404 });
        await assert.rejects(deleteMemoryForUser("alice", "memory-1"), { statusCode: 404 });
        assert.equal(update.mock.callCount(), 0);
        assert.equal(remove.mock.callCount(), 0);
    });

    await t.test("an owned update reloads the memory rather than assuming an array response", async (t) => {
        let changed = false;
        t.mock.method(client, "get", async () => ({
            id: "memory-1", userId: "alice", memory: changed ? "changed" : "original",
        }));
        t.mock.method(client, "update", async () => { changed = true; return { message: "Updated" }; });
        const memory = await updateMemoryForUser("alice", "memory-1", { memory: "changed" });
        assert.equal(memory.memory, "changed");
    });
});
