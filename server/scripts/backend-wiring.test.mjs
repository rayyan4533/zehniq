import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
process.env.MEM0_TELEMETRY = "false";
process.env.INNGEST_DEV = "1";
process.env.CLIENT_URL = "http://localhost:3000";
process.env.DATABASE_URL ??= "postgresql://localhost/notebook_test";
const { default: express } = await import("express");
const { createChatController } = await import("../src/modules/chat/chat.controller.ts");
const { createChatRoutes } = await import("../src/modules/chat/chat.route.ts");
const { createArtifactController } = await import("../src/modules/artifact/artifact.controller.ts");
const { createArtifactRoutes } = await import("../src/modules/artifact/artifact.route.ts");
const { errorHandler } = await import("../src/middleware/error-handler.middleware.ts");
const { NotFoundError } = await import("../src/types/app-error.ts");

async function listen(app, t) {
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    t.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }));
    return `http://127.0.0.1:${server.address().port}`;
}

function featureApp(chat, artifact) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.session = { user: { id: "alice" } }; next(); });
    app.use("/api/workspaces/:workspaceId", createChatRoutes(createChatController(chat)));
    app.use("/api/workspaces/:workspaceId/artifacts", createArtifactRoutes(createArtifactController(artifact)));
    app.use(errorHandler);
    return app;
}

const message = { id: "m1", role: "user", parts: [{ type: "text", text: "Explain my notes" }] };

test("chat HTTP wiring validates messages, forwards identity, and streams", async (t) => {
    let calls = 0;
    const service = {
        async streamWorkspaceChat(res, workspaceId, userId, input) {
            calls++;
            assert.equal(workspaceId, "ws1"); assert.equal(userId, "alice");
            assert.deepEqual(input.messages, [message]);
            res.setHeader("X-Conversation-Id", "c1");
            res.setHeader("Content-Type", "text/event-stream");
            res.write('data: {"type":"start"}\n\n'); res.end("data: [DONE]\n\n");
        },
        async createConversationForWorkspace(workspaceId, userId, title) {
            assert.deepEqual([workspaceId, userId, title], ["ws1", "alice", "Revision"]);
            return { id: "c1" };
        },
        async getConversationMessagesForWorkspace(workspaceId, conversationId, userId) {
            assert.deepEqual([workspaceId, conversationId, userId], ["ws1", "c1", "alice"]);
            return [{ content: "Saved message" }];
        },
        async deleteConversationForWorkspace() {},
    };
    const base = await listen(featureApp(service, {}), t);
    const send = (body) => fetch(`${base}/api/workspaces/ws1/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    for (const messages of [[{ role: "user" }], [{ ...message, role: "system" }], [{ ...message, parts: [{ type: "text", text: " " }] }]]) {
        assert.equal((await send({ messages })).status, 400);
    }
    assert.equal(calls, 0);
    const response = await send({ messages: [message] });
    assert.equal(response.status, 200); assert.equal(response.headers.get("x-conversation-id"), "c1");
    assert.match(await response.text(), /DONE/); assert.equal(calls, 1);
    const created = await fetch(`${base}/api/workspaces/ws1/conversations`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "Revision" }),
    });
    assert.equal(created.status, 201);
    const history = await fetch(`${base}/api/workspaces/ws1/conversations/c1/messages`);
    assert.deepEqual(await history.json(), [{ content: "Saved message" }]);
    assert.equal((await fetch(`${base}/api/workspaces/ws1/conversations/c1`, { method: "DELETE" })).status, 204);
});

test("artifact HTTP wiring validates, preserves workspace scope, and forwards errors", async (t) => {
    let calls = 0;
    const service = {
        async createArtifactForWorkspace(workspaceId, userId, input) {
            calls++; assert.deepEqual([workspaceId, userId, input.type], ["ws1", "alice", "QUIZ"]);
            return { id: "a1", status: "PENDING" };
        },
        async listArtifactsForWorkspace() { return []; },
        async getArtifactForWorkspace(workspaceId, artifactId, userId) {
            assert.deepEqual([workspaceId, artifactId, userId], ["ws1", "a1", "alice"]);
            throw new NotFoundError("Artifact not found");
        },
        async deleteArtifactForWorkspace() {},
    };
    const base = await listen(featureApp({}, service), t);
    const url = `${base}/api/workspaces/ws1/artifacts`;
    const post = (type) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type }) });
    assert.equal((await post("INVALID")).status, 400); assert.equal(calls, 0);
    const created = await post("QUIZ"); assert.equal(created.status, 201);
    assert.equal((await created.json()).status, "PENDING");
    assert.deepEqual(await (await fetch(url)).json(), []);
    const missing = await fetch(`${url}/a1`); assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), { error: "Artifact not found" });
    assert.equal((await fetch(`${url}/a1`, { method: "DELETE" })).status, 204);
    assert.equal((await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" })).status, 400);
});

test("real app protects mounted endpoints and exposes three Inngest jobs", async (t) => {
    const { Pool } = await import("pg");
    t.mock.method(Pool.prototype, "connect", async () => { throw new Error("Database disabled in HTTP wiring test"); });
    const { auth } = await import("../src/lib/auth.ts");
    t.mock.method(auth.api, "getSession", async () => null);
    const { app } = await import("../src/app.ts");
    const base = await listen(app, t);
    for (const [method, path] of [
        ["POST", "/chat"], ["GET", "/conversations"], ["POST", "/conversations"],
        ["GET", "/conversations/c1/messages"], ["DELETE", "/conversations/c1"],
        ["GET", "/artifacts"], ["POST", "/artifacts"], ["GET", "/artifacts/a1"],
        ["DELETE", "/artifacts/a1"], ["POST", "/sources/s1/retry"],
    ]) {
        const response = await fetch(`${base}/api/workspaces/ws1${path}`, { method });
        assert.equal(response.status, 401, `${method} ${path}`);
    }
    assert.equal((await fetch(`${base}/api/memory`)).status, 401);
    const info = await (await fetch(`${base}/api/inngest`)).json();
    assert.equal(info.function_count, 3);
    const preflight = await fetch(`${base}/api/workspaces/ws1/chat`, { method: "OPTIONS", headers: { Origin: "http://localhost:3000", "Access-Control-Request-Method": "POST" } });
    assert.equal(preflight.status, 204);
    const response = await fetch(`${base}/health`, { headers: { Origin: "http://localhost:3000" } });
    assert.match(response.headers.get("access-control-expose-headers"), /X-Conversation-Id/i);
});
