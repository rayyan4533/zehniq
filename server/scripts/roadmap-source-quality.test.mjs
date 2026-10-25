import assert from "node:assert/strict";
import { test } from "node:test";
process.env.DATABASE_URL ??= "postgresql://localhost/notebook_test";
const { usableRoadmapSources } = await import("../src/modules/roadmap/roadmap-generation.service.ts");
const { roadmapGenerationError, NO_USABLE_ROADMAP_SOURCES, NO_VERIFIED_ROADMAP_RESOURCES } = await import("../src/modules/roadmap/roadmap-errors.ts");

test("unusable uploads stay out of the teaching catalog and carry a named limitation", () => {
    const analysis = { subject: "RAG", learnerStartingPoint: "Beginner", topics: [], gaps: [], excludedSources: [{ sourceId: "placeholder", reason: "Contains repeated placeholder text without learning content." }] };
    const resources = [
        { id: "good", sourceId: "notes", title: "RAG notes", origin: "uploaded", type: "text" },
        { id: "bad", sourceId: "placeholder", title: "ttgg", origin: "uploaded", type: "text" },
        { id: "external", title: "Verified documentation", origin: "web", type: "website", url: "https://example.com/docs" },
    ];
    const original = structuredClone({ analysis, resources });
    const result = usableRoadmapSources(analysis, resources);
    assert.deepEqual(result.resources.map((resource) => resource.id), ["good", "external"]);
    assert.equal(result.limitations.length, 1);
    assert.match(result.limitations[0], /ttgg/);
    assert.match(result.limitations[0], /placeholder text/);
    assert.deepEqual({ analysis, resources }, original);
    assert.deepEqual(usableRoadmapSources({ ...analysis, excludedSources: [] }, resources).limitations, []);
});

test("roadmap failures explain unusable material without exposing internal errors", () => {
    assert.equal(roadmapGenerationError(NO_USABLE_ROADMAP_SOURCES), NO_USABLE_ROADMAP_SOURCES);
    assert.equal(roadmapGenerationError(NO_VERIFIED_ROADMAP_RESOURCES), NO_VERIFIED_ROADMAP_RESOURCES);
    const message = roadmapGenerationError("SQL failure /private/path credentials=secret");
    assert.match(message, /Please try again/);
    assert.doesNotMatch(message, /SQL|private|credentials|secret/);
});
