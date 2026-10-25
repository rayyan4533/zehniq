import assert from "node:assert/strict";
import { test } from "node:test";
process.env.DATABASE_URL ??= "postgresql://localhost/notebook_test";
const { standaloneRoadmapInput } = await import("../src/modules/roadmap/standalone.service.ts");
const { createRoadmapSchema } = await import("../src/modules/roadmap/roadmap.service.ts");
const { sourceIndexNamespace } = await import("../src/modules/source/source-scope.ts");
const { roadmapAnalysisPlannerSchema, analysisPlannerToAnalysis, validateRoadmapAnalysis } = await import("../src/modules/roadmap/roadmap.schema.ts");

test("standalone roadmaps accept sources, topics, or both without notebook fields", () => {
    assert.deepEqual(standaloneRoadmapInput.parse({ durationMonths: 1, topicGoals: ["Docker"] }), { durationMonths: 1, sourceIds: [], topicGoals: ["Docker"] });
    assert.equal(standaloneRoadmapInput.parse({ durationMonths: 2, sourceIds: ["source"] }).topicGoals.length, 0);
    assert.equal(standaloneRoadmapInput.parse({ durationMonths: 3, sourceIds: ["source"], topicGoals: ["Evaluation"] }).durationMonths, 3);
    for (const body of [{ durationMonths: 1 }, { durationMonths: 4, topicGoals: ["Docker"] }, { durationMonths: 1, topicGoals: [" "] }, { durationMonths: 1, topicGoals: ["Docker"], workspaceId: "foreign-notebook" }]) assert.throws(() => standaloneRoadmapInput.parse(body));
    assert.throws(() => createRoadmapSchema.parse({ durationMonths: 1, sourceIds: [] }));
    assert.throws(() => createRoadmapSchema.parse({ durationMonths: 1, sourceIds: ["source"], topicGoals: ["Docker"] }));
});

test("standalone source namespaces are isolated and cannot claim two owners", () => {
    assert.equal(sourceIndexNamespace({ workspaceId: "notebook", collectionId: null }), "notebook");
    assert.equal(sourceIndexNamespace({ workspaceId: null, collectionId: "path" }), "standalone:path");
    assert.throws(() => sourceIndexNamespace({ workspaceId: "notebook", collectionId: "path" }));
    assert.throws(() => sourceIndexNamespace({ workspaceId: null, collectionId: null }));
});

test("topic-only analysis cannot claim uploaded coverage", () => {
    const input = { subject: "Python", learnerStartingPoint: "Beginner", excludedSources: [], topics: [
        { title: "Asyncio", sourceIds: [], prerequisiteIndexes: [], difficulty: "beginner", essential: true, gap: { reason: "No study materials were supplied", searchQuery: "Python asyncio official documentation", candidateUrls: [] } },
        { title: "Testing async code", sourceIds: [], prerequisiteIndexes: [0], difficulty: "intermediate", essential: true, gap: null },
    ] };
    const parsed = roadmapAnalysisPlannerSchema([]).parse(input);
    assert.equal(validateRoadmapAnalysis(analysisPlannerToAnalysis(parsed), []).topics.length, 2);
    assert.throws(() => roadmapAnalysisPlannerSchema([]).parse({ ...input, topics: [{ ...input.topics[0], sourceIds: ["invented-source"] }, input.topics[1]] }));
});
