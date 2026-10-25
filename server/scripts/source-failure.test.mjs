import assert from "node:assert/strict";
import { test } from "node:test";

process.env.INNGEST_DEV = "1";
process.env.DATABASE_URL ??= "postgresql://localhost/notebook_test";
const { processSource } = await import("../src/modules/source/source.job.ts");

test("final failure removes the source before scheduling external cleanup", async () => {
    const steps = [];
    await processSource.onFailureFn({
        event: { data: { event: { data: { sourceId: "source", workspaceId: "workspace" } } } },
        step: { run: async (name) => {
            steps.push(name);
            if (name === "load-failed-source") return { id: "source", status: "PROCESSING", metadata: {} };
        } },
    });
    assert.deepEqual(steps, ["load-failed-source", "remove-failed-source", "remove-failed-vectors", "remove-failed-pdf"]);
});

test("duplicate failure delivery leaves an already removed or ready source alone", async () => {
    for (const source of [null, { status: "READY" }]) {
        const steps = [];
        await processSource.onFailureFn({
            event: { data: { event: { data: { sourceId: "source", workspaceId: "workspace" } } } },
            step: { run: async (name) => { steps.push(name); return source; } },
        });
        assert.deepEqual(steps, ["load-failed-source"]);
    }
});
