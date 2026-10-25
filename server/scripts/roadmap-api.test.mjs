import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import express from "express";
process.env.DATABASE_URL ??= "postgresql://localhost/notebook_test";
const { createRoadmapController } = await import("../src/modules/roadmap/roadmap.controller.ts");
const { createRoadmapRoutes } = await import("../src/modules/roadmap/roadmap.route.ts");
const { errorHandler } = await import("../src/middleware/error-handler.middleware.ts");

async function featureApp(t, service) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.session = { user: { id: "alice" } }; next(); });
    app.use("/api/workspaces/:workspaceId/roadmaps", createRoadmapRoutes(createRoadmapController(service)));
    app.use(errorHandler);
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    t.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }));
    const base = `http://127.0.0.1:${server.address().port}/api/workspaces/workspace/roadmaps`;
    return (path = "", method = "GET", body) => fetch(`${base}${path}`, {
        method, ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    });
}

test("roadmap creation permits only the three durations and forwards authenticated scope", async (t) => {
    let creates = 0;
    const send = await featureApp(t, { async create(workspaceId, userId, input) {
        creates++;
        assert.deepEqual([workspaceId, userId], ["workspace", "alice"]);
        assert.deepEqual(input, { durationMonths: 2, sourceIds: ["source"] });
        return { id: "roadmap", status: "generating" };
    } });
    for (const durationMonths of [0, 0.5, 4, "1", null]) {
        assert.equal((await send("", "POST", { durationMonths, sourceIds: ["source"] })).status, 400);
    }
    assert.equal((await send("", "POST", { durationMonths: 2, sourceIds: [] })).status, 400);
    assert.equal((await send("", "POST", { durationMonths: 2, sourceIds: ["source"], userId: "bob" })).status, 400);
    assert.equal(creates, 0);
    const accepted = await send("", "POST", { durationMonths: 2, sourceIds: ["source", "source"] });
    assert.equal(accepted.status, 202);
    assert.deepEqual(await accepted.json(), { id: "roadmap", status: "generating" });
});

test("progress accepts explicit booleans and resource visits are separate from completion", async (t) => {
    let taskChanges = 0;
    let resourceOpens = 0;
    const send = await featureApp(t, {
        async setTask(workspaceId, roadmapId, taskId, userId, input) {
            taskChanges++;
            assert.deepEqual([workspaceId, roadmapId, taskId, userId], ["workspace", "roadmap", "task", "alice"]);
            assert.equal(input.isCompleted, false);
            return { progress: { completedTasks: 0, totalTasks: 8, percent: 0 } };
        },
        async openResource(...args) {
            resourceOpens++;
            assert.deepEqual(args, ["workspace", "roadmap", "resource", "alice"]);
        },
    });
    assert.equal((await send("/roadmap/tasks/task", "PATCH", { isCompleted: "false" })).status, 400);
    assert.equal((await send("/roadmap/tasks/task", "PATCH", { isCompleted: false })).status, 200);
    assert.equal((await send("/roadmap/resources/resource/open", "POST")).status, 204);
    assert.equal(taskChanges, 1);
    assert.equal(resourceOpens, 1);
});

test("PDFs are delivered inline with private caching and same-origin framing", async (t) => {
    const send = await featureApp(t, { async pdf(...args) {
        assert.deepEqual(args, ["workspace", "roadmap", "resource", "alice"]);
        return Buffer.from("%PDF-1.4\n");
    } });
    const response = await send("/roadmap/resources/resource/file");
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /application\/pdf/);
    assert.match(response.headers.get("content-disposition"), /^inline/);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(response.headers.get("content-security-policy"), "frame-ancestors 'self'");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
});
