import assert from "node:assert/strict";
import { test } from "node:test";
process.env.DATABASE_URL ??= "postgresql://localhost/notebook_test";
const { createRoadmapService } = await import("../src/modules/roadmap/roadmap.service.ts");
const { roadmapProgress, roadmapAnalytics } = await import("../src/modules/roadmap/roadmap-analytics.ts");
const { NotFoundError } = await import("../src/types/app-error.ts");
const content = {
    title: "A source-grounded roadmap", resources: [{ id: "resource", title: "Uploaded notes", type: "text", origin: "uploaded", sourceId: "source" }],
    weeks: Array.from({ length: 4 }, (_, index) => ({
        id: `week-${index + 1}`, weekNumber: index + 1, title: `Week ${index + 1}`, objective: "Understand and implement the source concepts", topics: ["Concept"],
        tasks: [{ id: `study-${index + 1}`, title: "Read the source and explain the concept", resourceIds: ["resource"], kind: "study", estimatedMinutes: 20 }, { id: `practice-${index + 1}`, title: "Build and test a working example", resourceIds: ["resource"], kind: "practice", estimatedMinutes: 40 }],
    })),
};
const row = { id: "roadmap", workspaceId: "workspace", title: content.title, durationMonths: 1, status: "ready", phase: "ready", sourceIds: ["source"], content, limitations: [], createdAt: "2026-10-25T00:00:00Z", updatedAt: "2026-10-25T00:00:00Z" };
function fixture() {
    let states = []; const activities = []; let writes = 0;
    const deps = {
        getWorkspaceByIdForUser: async (_workspace, userId) => { if (userId !== "owner") throw new NotFoundError("Workspace not found"); return { title: "Workspace" }; },
        findRoadmapByIdAndWorkspaceId: async (id, workspaceId) => id === row.id && workspaceId === row.workspaceId ? row : null,
        findRoadmapsByWorkspaceId: async () => [row], findRoadmapProgress: async () => states, findRoadmapActivity: async () => activities,
        setRoadmapTaskProgress: async (_id, taskId, isCompleted) => { writes++; states = [{ taskId, isCompleted }]; },
        findSourceByIdAndWorkspaceId: async (id, workspaceId) => id === "source" && workspaceId === "workspace" ? { id, content: "Real extracted source text", type: "TEXT", metadata: { fileUrl: "private-secret" } } : null,
        recordRoadmapResourceOpen: async (_id, resourceId) => { activities.push({ resourceId, kind: "resource_opened", createdAt: "2026-10-25T00:00:00Z" }); },
        findSourcesByWorkspaceId: async () => [{ id: "source", content: "Extracted text", status: "READY" }],
        createRoadmapRecord: async (input) => { writes++; return { ...row, ...input, content: null, status: "generating" }; }, enqueue: async () => {},
    };
    return { service: createRoadmapService(deps), deps, writes: () => writes };
}

test("progress is derived from saved states, including empty roadmaps", () => {
    assert.deepEqual(roadmapProgress([], []), { completedTasks: 0, totalTasks: 0, percent: 0, currentWeek: null });
    assert.deepEqual(roadmapProgress(content.weeks, [{ taskId: "study-1", isCompleted: true }, { taskId: "practice-1", isCompleted: true }]), { completedTasks: 2, totalTasks: 8, percent: 25, currentWeek: 2 });
});
test("analytics use saved activity and estimated effort, and deduplicate repeated same-day completion", () => {
    const result = roadmapAnalytics(content.weeks, [{ taskId: "study-1", isCompleted: true }], [
        { taskId: "study-1", kind: "task_completed", createdAt: "2026-10-24T20:00:00Z" }, { taskId: "study-1", kind: "task_completed", createdAt: "2026-10-24T21:00:00Z" }, { resourceId: "resource", kind: "resource_opened", createdAt: "2026-10-25T08:00:00Z" },
    ], new Date("2026-10-25T12:00:00Z"));
    assert.equal(result.completedTasks, 1); assert.equal(result.percent, 13); assert.equal(result.resourceOpens, 1); assert.equal(result.streakDays, 2); assert.equal(result.estimatedMinutesCompleted, 20); assert.equal(result.dailyActivity.length, 14); assert.equal(result.dailyActivity.at(-2).completedTasks, 1);
});
test("task progress reloads across service instances and reopening restores progress", async () => {
    const { service, deps } = fixture();
    assert.equal((await service.setTask("workspace", "roadmap", "study-1", "owner", { isCompleted: true })).progress.completedTasks, 1);
    assert.equal((await createRoadmapService(deps).get("workspace", "roadmap", "owner")).weeks[0].tasks[0].isCompleted, true);
    assert.equal((await service.setTask("workspace", "roadmap", "study-1", "owner", { isCompleted: false })).progress.completedTasks, 0);
});
test("authorization and task validation happen before progress mutation", async () => {
    const { service, writes } = fixture();
    await assert.rejects(service.setTask("workspace", "roadmap", "study-1", "intruder", { isCompleted: true }), { statusCode: 404 });
    await assert.rejects(service.setTask("other", "roadmap", "study-1", "owner", { isCompleted: true }), { statusCode: 404 });
    await assert.rejects(service.setTask("workspace", "roadmap", "unknown", "owner", { isCompleted: true }), { statusCode: 404 });
    assert.equal(writes(), 0);
});
test("roadmap deletion checks ownership and workspace scope before deleting", async () => {
    const { deps } = fixture();
    const deleted = [];
    const service = createRoadmapService({ ...deps, deleteRoadmapRecord: async (id) => { deleted.push(id); } });
    await assert.rejects(service.remove("workspace", "roadmap", "intruder"), { statusCode: 404 });
    await assert.rejects(service.remove("other", "roadmap", "owner"), { statusCode: 404 });
    assert.deepEqual(deleted, []);
    await service.remove("workspace", "roadmap", "owner");
    assert.deepEqual(deleted, ["roadmap"]);
});
test("only permitted durations and ready source IDs can create roadmaps", async () => {
    const { service, writes } = fixture();
    await assert.rejects(service.create("workspace", "owner", { durationMonths: 0, sourceIds: ["source"] }));
    await assert.rejects(service.create("workspace", "owner", { durationMonths: 1, sourceIds: ["foreign"] }), { statusCode: 400 });
    assert.equal(writes(), 0);
    assert.equal((await service.create("workspace", "owner", { durationMonths: 1, sourceIds: ["source"] })).status, "generating");
});
test("resource opening never exposes storage secrets or marks tasks complete", async () => {
    const { service, writes } = fixture();
    const resource = await service.resource("workspace", "roadmap", "resource", "owner");
    assert.equal(resource.content, "Real extracted source text"); assert.equal(JSON.stringify(resource).includes("private-secret"), false);
    await service.openResource("workspace", "roadmap", "resource", "owner"); assert.equal(writes(), 0);
    assert.equal((await service.get("workspace", "roadmap", "owner")).progress.completedTasks, 0);
    assert.equal((await service.analytics("workspace", "roadmap", "owner")).resourceOpens, 1);
});
