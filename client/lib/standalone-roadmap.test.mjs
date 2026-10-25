import assert from "node:assert/strict";
import { test } from "node:test";
import { parseTopicGoals } from "./standalone-roadmap.ts";
import { roadmapFileUrl } from "./roadmap.ts";

test("topic names support lines and commas, trim whitespace, and deduplicate", () => {
  assert.deepEqual(parseTopicGoals("Docker, Evaluation\nDocker\n Deployment  "), ["Docker", "Evaluation", "Deployment"]);
  assert.deepEqual(parseTopicGoals(" ,\n"), []);
  assert.throws(() => parseTopicGoals("x".repeat(201)), /200/);
  assert.throws(() => parseTopicGoals(Array.from({ length: 21 }, (_, i) => `Topic ${i}`).join("\n")), /20/);
});
test("PDF paths support isolated standalone collections while keeping notebook paths", () => {
  assert.equal(roadmapFileUrl("/roadmaps/collections/path/roadmaps/plan/resources/pdf/file"), "/api/roadmaps/collections/path/roadmaps/plan/resources/pdf/file");
  assert.equal(roadmapFileUrl("/workspaces/notebook/roadmaps/plan/resources/pdf/file"), "/api/workspaces/notebook/roadmaps/plan/resources/pdf/file");
  assert.equal(roadmapFileUrl("https://storage.example/private.pdf"), null);
});
