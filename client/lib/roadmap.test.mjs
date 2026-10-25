import assert from "node:assert/strict";
import { test } from "node:test";
import { taskProgress, roadmapProgress, toggleRoadmapTask, safeResourceUrl, roadmapFileUrl, durationChoices } from "./roadmap.ts";

test("progress derives from task states and empty roadmaps stay at zero", () => {
  assert.deepEqual(taskProgress([]), { completedTasks: 0, totalTasks: 0, percent: 0 });
  assert.deepEqual(taskProgress([{ isCompleted: true }, { isCompleted: false }, { isCompleted: false }]), { completedTasks: 1, totalTasks: 3, percent: 33 });
  const weeks = [{ weekNumber: 1, tasks: [{ isCompleted: true }] }, { weekNumber: 2, tasks: [{ isCompleted: false }] }];
  assert.deepEqual(roadmapProgress(weeks), { completedTasks: 1, totalTasks: 2, percent: 50, currentWeek: 2 });
  assert.equal(roadmapProgress([]).currentWeek, null);
});

test("optimistic completion is immutable and reversible", () => {
  const original = { id: "roadmap", weeks: [{ weekNumber: 1, tasks: [{ id: "task", isCompleted: false }] }], progress: { completedTasks: 0, totalTasks: 1, percent: 0, currentWeek: 1 } };
  const next = toggleRoadmapTask(original, "task", true);
  assert.equal(original.weeks[0].tasks[0].isCompleted, false);
  assert.equal(next.progress.percent, 100);
  assert.equal(next.progress.currentWeek, null);
  assert.equal(toggleRoadmapTask(next, "task", false).progress.percent, 0);
});

test("resource viewing accepts web URLs and authenticated PDF paths only", () => {
  assert.equal(safeResourceUrl("https://example.com/docs"), "https://example.com/docs");
  for (const value of ["javascript:alert(1)", "data:text/html,bad", "file:///private", "https://user:password@example.com", "not a url"]) assert.equal(safeResourceUrl(value), null);
  assert.equal(roadmapFileUrl("/workspaces/w/roadmaps/r/resources/p/file"), "/api/workspaces/w/roadmaps/r/resources/p/file");
  for (const value of ["https://example.com/private.pdf", "//example.com/file", "/workspaces/w/roadmaps/r/resources/p/file?token=secret"]) assert.equal(roadmapFileUrl(value), null);
});

test("duration choices are exclusively one, two or three months", () => {
  assert.deepEqual(durationChoices.map(({ months, weeks }) => [months, weeks]), [[1, 4], [2, 8], [3, 12]]);
});
