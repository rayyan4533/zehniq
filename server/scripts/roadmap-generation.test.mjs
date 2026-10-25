import assert from "node:assert/strict";
import { test } from "node:test";
process.env.DATABASE_URL ??= "postgresql://localhost/notebook_test";
const { validateRoadmapContent, validateRoadmapAnalysis, roadmapPlannerSchema, plannerToDraft, roadmapAnalysisPlannerSchema, analysisPlannerToAnalysis } = await import("../src/modules/roadmap/roadmap.schema.ts");
const { materializeRoadmap, sampleSourceText } = await import("../src/modules/roadmap/roadmap-generation.service.ts");
const { isPublicAddress, publicWebUrl, researchRoadmapResources } = await import("../src/modules/roadmap/roadmap-research.ts");

const resource = { id: "resource-1", title: "Actual uploaded notes", origin: "uploaded", type: "text", sourceId: "source-1" };
const analysis = {
    subject: "Retrieval engineering", learnerStartingPoint: "Basic programming",
    topics: [
        { id: "basics", title: "Basic retrieval", sourceIds: ["source-1"], prerequisiteIds: [], difficulty: "beginner", essential: true },
        { id: "evaluation", title: "Retrieval evaluation", sourceIds: [], prerequisiteIds: ["basics"], difficulty: "intermediate", essential: true },
    ],
    gaps: [{ topicId: "evaluation", reason: "Missing evaluation material", searchQuery: "retrieval evaluation", candidateUrls: [] }],
};
function draft(months = 1) {
    return { title: "Build a retrieval application", weeks: Array.from({ length: months * 4 }, (_, index) => ({
        weekNumber: index + 1, title: `Milestone ${index + 1}`, objective: "Explain retrieval and verify its behavior",
        topicIds: index === 0 ? ["basics"] : ["evaluation"], expectedOutcome: "A tested retrieval exercise",
        tasks: [
            { title: "Read the notes and explain the retrieval pipeline in your own words", kind: "study", resourceIds: [resource.id], estimatedMinutes: 30, description: null },
            { title: "Implement a retrieval exercise and record three test results", kind: "practice", resourceIds: [], estimatedMinutes: null, description: null },
        ],
    })) };
}

test("materialization yields exactly 4, 8 or 12 weeks with deterministic IDs and no AI progress", () => {
    for (const months of [1, 2, 3]) {
        const content = materializeRoadmap(draft(months), analysis, [resource], months);
        assert.equal(content.weeks.length, months * 4);
        assert.equal(content.weeks[0].tasks[0].id, "week-1-task-1");
        assert.equal(content.weeks[0].tasks[0].isCompleted, undefined);
        assert.deepEqual(content.resources, [resource]);
        assert.throws(() => validateRoadmapContent(content, months === 1 ? 2 : 1), /exactly/);
    }
});

test("AI planner structurally requires study and practice tasks with catalog-only references", () => {
    const original = draft();
    const plan = { title: original.title, weeks: original.weeks.map((week) => ({
        title: week.title, objective: week.objective, topicIds: week.topicIds, expectedOutcome: week.expectedOutcome,
        studyTask: { title: week.tasks[0].title, description: null, resourceIds: [resource.id], estimatedMinutes: 30 },
        practiceTask: { title: week.tasks[1].title, description: null, resourceIds: [], estimatedMinutes: null },
        additionalTasks: [{ title: "Write a short explanation of the test results", description: null, resourceIds: [], estimatedMinutes: null, kind: "revision" }],
    })) };
    const schema = roadmapPlannerSchema(4, [resource.id], ["basics", "evaluation"]);
    const converted = plannerToDraft(schema.parse(plan));
    assert.ok(converted.weeks.every((week) => week.tasks.some((task) => task.kind === "study") && week.tasks.some((task) => task.kind === "practice")));
    assert.deepEqual(converted.weeks.map((week) => week.weekNumber), [1, 2, 3, 4]);
    assert.doesNotThrow(() => materializeRoadmap(converted, analysis, [resource], 1));
    const unknown = structuredClone(plan); unknown.weeks[0].studyTask.resourceIds = ["fabricated-resource"];
    assert.equal(schema.safeParse(unknown).success, false);
    const missing = structuredClone(plan); delete missing.weeks[0].practiceTask;
    assert.equal(schema.safeParse(missing).success, false);
});

test("analysis assigns topic IDs and gap references by construction, while validating prerequisite bounds", () => {
    const plan = {
        subject: analysis.subject, learnerStartingPoint: analysis.learnerStartingPoint,
        excludedSources: [],
        topics: [
            { title: "Basics", sourceIds: ["source-1"], prerequisiteIndexes: [], difficulty: "beginner", essential: true, gap: null },
            { title: "Evaluation", sourceIds: [], prerequisiteIndexes: [0], difficulty: "intermediate", essential: true, gap: { reason: "Missing", searchQuery: "retrieval evaluation", candidateUrls: [] } },
        ],
    };
    const converted = analysisPlannerToAnalysis(roadmapAnalysisPlannerSchema(["source-1"]).parse(plan));
    assert.deepEqual(converted.topics.map((topic) => topic.id), ["topic-1", "topic-2"]);
    assert.equal(converted.gaps[0].topicId, "topic-2");
    assert.deepEqual(converted.topics[1].prerequisiteIds, ["topic-1"]);
    assert.doesNotThrow(() => validateRoadmapAnalysis(converted, ["source-1"]));
    const missingDecisions = structuredClone(plan); delete missingDecisions.excludedSources;
    assert.equal(roadmapAnalysisPlannerSchema(["source-1"]).safeParse(missingDecisions).success, false);
    const unknown = structuredClone(plan); unknown.topics[1].prerequisiteIndexes = [29];
    assert.throws(() => validateRoadmapAnalysis(analysisPlannerToAnalysis(unknown), ["source-1"]), /topic-30/);
});

test("content validation reports every week's missing task roles and invalid task references together", () => {
    const content = materializeRoadmap(draft(), analysis, [resource], 1);
    content.weeks[0].tasks.forEach((task) => { task.kind = "study"; task.resourceIds = ["unknown-resource"]; });
    content.weeks[1].tasks.forEach((task) => { task.kind = "practice"; });
    assert.throws(() => validateRoadmapContent(content, 1), (error) => {
        assert.match(error.message, /Week 1 \(Milestone 1/);
        assert.match(error.message, /Missing practical/);
        assert.match(error.message, /unknown-resource/);
        assert.match(error.message, /Week 2 \(Milestone 2/);
        assert.match(error.message, /Missing source-grounded study/);
        return true;
    });
});

test("invalid duration, unknown resource IDs, duplicate IDs and storage URL leakage are rejected", () => {
    const content = materializeRoadmap(draft(), analysis, [resource], 1);
    assert.throws(() => validateRoadmapContent(content, 0));
    const badReference = structuredClone(content); badReference.weeks[0].tasks[0].resourceIds = ["fabricated"];
    assert.throws(() => validateRoadmapContent(badReference, 1), /unknown resource/);
    const duplicate = structuredClone(content); duplicate.weeks[1].tasks[0].id = duplicate.weeks[0].tasks[0].id;
    assert.throws(() => validateRoadmapContent(duplicate, 1), /Duplicate/);
    const leaked = structuredClone(content); leaked.resources[0].url = "https://example.com/private.pdf";
    assert.throws(() => validateRoadmapContent(leaked, 1), /storage URLs/);
    const completion = structuredClone(content); completion.weeks[0].tasks[0].isCompleted = true;
    assert.throws(() => validateRoadmapContent(completion, 1));
});

test("analysis rejects cyclic/unknown prerequisites and fabricated uploaded coverage", () => {
    assert.deepEqual(validateRoadmapAnalysis(analysis, ["source-1"]), analysis);
    const cycle = structuredClone(analysis); cycle.topics[0].prerequisiteIds = ["evaluation"];
    assert.throws(() => validateRoadmapAnalysis(cycle, ["source-1"]), /cycle/);
    const unknown = structuredClone(analysis); unknown.topics[1].prerequisiteIds = ["fabricated"];
    assert.throws(() => validateRoadmapAnalysis(unknown, ["source-1"]), /Unknown prerequisite/);
    const wrongSource = structuredClone(analysis); wrongSource.topics[0].sourceIds = ["another-users-source"];
    assert.throws(() => validateRoadmapAnalysis(wrongSource, ["source-1"]), /unknown source/);
    const coveredGap = structuredClone(analysis); coveredGap.gaps[0].topicId = "basics";
    assert.throws(() => validateRoadmapAnalysis(coveredGap, ["source-1"]), (error) => {
        assert.match(error.message, /basics/);
        assert.match(error.message, /source-1/);
        assert.match(error.message, /distinct missing subtopic/);
        return true;
    });
});

test("source analysis accounts for every selected upload before curriculum planning", () => {
    assert.throws(() => validateRoadmapAnalysis(analysis, ["source-1", "source-2"]), (error) => {
        assert.match(error.message, /source-2/);
        return true;
    });
    const excluded = { ...structuredClone(analysis), excludedSources: [{ sourceId: "source-2", reason: "The source contains only unrelated placeholder text and no usable learning material." }] };
    assert.deepEqual(validateRoadmapAnalysis(excluded, ["source-1", "source-2"]), excluded);
    // Existing stored analyses with complete attribution remain readable.
    assert.deepEqual(validateRoadmapAnalysis(analysis, ["source-1"]), analysis);
});

test("source exclusions reject foreign IDs, duplicate decisions, and covered sources", () => {
    const reason = "The source does not contain usable study material.";
    const unknown = { ...structuredClone(analysis), excludedSources: [{ sourceId: "foreign-source", reason }] };
    assert.throws(() => validateRoadmapAnalysis(unknown, ["source-1"]), /foreign-source/);
    const duplicate = { ...structuredClone(analysis), excludedSources: [{ sourceId: "source-2", reason }, { sourceId: "source-2", reason }] };
    assert.throws(() => validateRoadmapAnalysis(duplicate, ["source-1", "source-2"]), /source-2/);
    const conflicting = { ...structuredClone(analysis), excludedSources: [{ sourceId: "source-1", reason }] };
    assert.throws(() => validateRoadmapAnalysis(conflicting, ["source-1"]), /source-1/);
});

test("explicitly excluded uploads do not block a valid curriculum or enter its catalog", () => {
    const junk = { ...resource, id: "uploaded-placeholder", title: "Placeholder", sourceId: "source-2" };
    const sourceAnalysis = { ...structuredClone(analysis), excludedSources: [{ sourceId: junk.sourceId, reason: "Only unrelated placeholder text is available." }] };
    const originalAnalysis = structuredClone(sourceAnalysis);
    const input = draft();
    const originalDraft = structuredClone(input);
    const content = materializeRoadmap(input, sourceAnalysis, [resource, junk], 1);
    assert.deepEqual(content.resources, [resource]);
    assert.ok(content.weeks.every((week) => week.tasks.every((task) => !task.resourceIds.includes(junk.id))));
    assert.deepEqual(sourceAnalysis, originalAnalysis);
    assert.deepEqual(input, originalDraft);

    const invalid = draft(); invalid.weeks[0].tasks[0].resourceIds.push(junk.id);
    assert.throws(() => materializeRoadmap(invalid, sourceAnalysis, [resource, junk], 1), /unknown resource/i);
});

test("a pre-referenced upload cannot bypass missing source attribution", () => {
    const unsupported = { ...resource, id: "uploaded-unattributed", title: "Unattributed notes", sourceId: "source-2" };
    const input = draft(); input.weeks[0].tasks[0].resourceIds.push(unsupported.id);
    assert.throws(() => materializeRoadmap(input, analysis, [resource, unsupported], 1), /source-evidenced/);
});

test("references in an unrelated week still require study coverage in an evidenced week", () => {
    const lecture = { ...resource, id: "uploaded-lecture", title: "Evaluation lecture", sourceId: "source-2", type: "youtube" };
    const sourceAnalysis = structuredClone(analysis);
    sourceAnalysis.topics[1].sourceIds = [lecture.sourceId];
    sourceAnalysis.gaps = [];
    const input = draft(); input.weeks[0].tasks[0].resourceIds.push(lecture.id);
    const untouched = structuredClone(input);
    const content = materializeRoadmap(input, sourceAnalysis, [resource, lecture], 1);
    assert.ok(content.weeks[1].tasks.some((task) => task.kind === "study" && task.resourceIds.includes(lecture.id)));
    assert.deepEqual(input, untouched, "adding supported coverage must not mutate the original draft");
});

test("curriculum cannot schedule a dependent before its prerequisite or omit selected sources", () => {
    const wrongOrder = draft(); wrongOrder.weeks[0].topicIds = ["evaluation"]; wrongOrder.weeks[1].topicIds = ["basics"];
    assert.throws(() => materializeRoadmap(wrongOrder, analysis, [resource], 1), /Prerequisite ordering/);
    assert.throws(() => materializeRoadmap(draft(), analysis, [resource, { ...resource, id: "unused", sourceId: "source-2" }], 1), /no scheduled, source-evidenced topic/);
    const vague = draft(); vague.weeks[0].tasks[0].title = "Learn about RAG";
    assert.throws(() => materializeRoadmap(vague, analysis, [resource], 1), /week-1-task-1/);
});

test("omitted uploaded resources gain concrete study tasks only in source-evidenced weeks", () => {
    const input = draft();
    const untouched = structuredClone(input);
    const extra = { ...resource, id: "uploaded-video", title: "Actual lecture", sourceId: "source-2", type: "youtube" };
    const sourceAnalysis = structuredClone(analysis);
    sourceAnalysis.topics[1].sourceIds = ["source-2"];
    sourceAnalysis.gaps = [];
    const content = materializeRoadmap(input, sourceAnalysis, [resource, extra], 1);
    assert.deepEqual(input, untouched, "normalization must not mutate the planner output across retries");
    const added = content.weeks[1].tasks.find((task) => task.resourceIds.includes(extra.id));
    assert.match(added.title, /^Watch Actual lecture and write three key ideas related to Retrieval evaluation/);
    assert.equal(added.estimatedMinutes, undefined);
    assert.equal(added.kind, "study");
    assert.ok(!content.weeks[0].tasks.some((task) => task.resourceIds.includes(extra.id)));
});

test("coverage tasks group at most eight evidenced resources and never exceed twelve tasks per week", () => {
    const input = draft();
    const sourceAnalysis = structuredClone(analysis);
    const extras = Array.from({ length: 10 }, (_, index) => ({ ...resource, id: `extra-${index}`, sourceId: `source-${index + 2}` }));
    sourceAnalysis.topics[0].sourceIds.push(...extras.map((item) => item.sourceId));
    const content = materializeRoadmap(input, sourceAnalysis, [resource, ...extras], 1);
    const coverage = content.weeks[0].tasks.filter((task) => task.resourceIds.some((id) => id.startsWith("extra-")));
    assert.equal(coverage.length, 2);
    assert.ok(coverage.every((task) => task.resourceIds.length <= 8));
    assert.ok(content.weeks.every((week) => week.tasks.length <= 12));
    const full = draft();
    full.weeks[0].tasks = Array.from({ length: 12 }, () => structuredClone(full.weeks[0].tasks[0]));
    assert.throws(() => materializeRoadmap(full, sourceAnalysis, [resource, ...extras], 1), /no scheduled, source-evidenced topic/);
});

test("actionability considers title and description and reports every vague task", () => {
    const concrete = draft();
    concrete.weeks[0].tasks[0].title = "Study retrieval and explain its components";
    concrete.weeks[1].tasks[0].title = "Understand evaluation";
    concrete.weeks[1].tasks[0].description = "Read the source, then write three measurable retrieval checks.";
    assert.doesNotThrow(() => materializeRoadmap(concrete, analysis, [resource], 1));
    const vague = draft();
    vague.weeks[0].tasks[0].title = "Learn about RAG";
    vague.weeks[1].tasks[0].title = "Understand vector databases";
    assert.throws(() => materializeRoadmap(vague, analysis, [resource], 1), (error) => {
        assert.match(error.message, /week-1-task-1/);
        assert.match(error.message, /week-2-task-1/);
        return true;
    });
});

test("source sampling includes beginning, middle and end within the budget", () => {
    const sampled = sampleSourceText(`BEGIN${"x".repeat(5000)}MIDDLE${"y".repeat(5000)}END`, 1200);
    assert.match(sampled, /BEGIN/); assert.match(sampled, /MIDDLE/); assert.match(sampled, /END/);
    assert.ok(sampled.length <= 1200);
});

test("resource verification excludes local, private, encoded loopback and unsafe protocols", () => {
    for (const address of ["127.0.0.1", "10.2.3.4", "169.254.169.254", "100.64.0.1", "192.168.1.1", "::1", "fc00::1", "::ffff:127.0.0.1", "2001:db8::1", "2002:7f00:1::"]) assert.equal(isPublicAddress(address), false, address);
    assert.equal(isPublicAddress("185.199.108.153"), true);
    assert.equal(isPublicAddress("2606:50c0:8001::153"), true);
    for (const url of ["file:///etc/passwd", "http://localhost/", "http://2130706433/", "http://127.1/", "https://user:pass@example.com", "https://example.com:8080", "http://[::1]/"]) assert.throws(() => publicWebUrl(url), undefined, url);
    assert.equal(publicWebUrl("https://example.com/docs#section").href, "https://example.com/docs");
});

test("unavailable search reports limitations and no fabricated resources", async () => {
    const result = await researchRoadmapResources(analysis, { configured: () => false, search: async () => { throw new Error("must not search"); }, verify: async () => { throw new Error("must not verify empty candidates"); } });
    assert.deepEqual(result.resources, []);
    assert.ok(result.limitations.some((message) => message.includes("Web search is unavailable")));
});

test("model candidates are included only after verification, even when search is unavailable", async () => {
    const input = structuredClone(analysis); input.gaps[0].candidateUrls = ["https://example.com/real", "https://example.com/fabricated"];
    const result = await researchRoadmapResources(input, {
        configured: () => false, search: async () => { throw new Error("must not search"); },
        verify: async (candidate) => candidate.url.endsWith("/real") ? { id: "verified", title: "Actual title", type: "website", origin: "web", url: candidate.url } : null,
    });
    assert.equal(result.resources.length, 1);
    assert.equal(result.resources[0].url, "https://example.com/real");
    assert.match(result.resources[0].description, /independently verified/);
});

test("search failures and rejected verification remain visible as gaps", async () => {
    const result = await researchRoadmapResources(analysis, { configured: () => true, search: async () => { throw new Error("provider unavailable"); }, verify: async () => null });
    assert.deepEqual(result.resources, []);
    assert.ok(result.limitations.some((message) => message.includes("Web research was unavailable")));
});
