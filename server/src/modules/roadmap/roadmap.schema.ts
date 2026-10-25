import { z } from "zod";

export const roadmapDurationSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
const text = (max: number) => z.string().trim().min(1).max(max);
export const roadmapResourceSchema = z.object({
    id: text(160), title: text(300),
    type: z.enum(["pdf", "youtube", "website", "text", "markdown"]),
    origin: z.enum(["uploaded", "web"]),
    sourceId: text(160).optional(), url: z.string().url().max(2000).optional(),
    pageNumber: z.number().int().positive().optional(),
    timestampSeconds: z.number().int().nonnegative().optional(),
    sectionTitle: text(300).optional(), description: text(1000).optional(),
}).strict();
export const roadmapTaskSchema = z.object({
    id: text(160), title: text(600), description: text(2000).optional(),
    resourceIds: z.array(text(160)).max(8),
    estimatedMinutes: z.number().int().min(5).max(1440).optional(),
    kind: z.enum(["study", "practice", "revision"]),
}).strict();
export const roadmapWeekSchema = z.object({
    id: text(160), weekNumber: z.number().int().min(1).max(12),
    title: text(300), objective: text(2000), topics: z.array(text(300)).min(1).max(20),
    tasks: z.array(roadmapTaskSchema).min(2).max(12), expectedOutcome: text(2000).optional(),
}).strict();
export const roadmapContentSchema = z.object({
    title: text(300), weeks: z.array(roadmapWeekSchema).min(4).max(12),
    resources: z.array(roadmapResourceSchema).min(1).max(140),
}).strict();
export type RoadmapResource = z.infer<typeof roadmapResourceSchema>;
export type RoadmapTask = z.infer<typeof roadmapTaskSchema>;
export type RoadmapWeek = z.infer<typeof roadmapWeekSchema>;
export type RoadmapContent = z.infer<typeof roadmapContentSchema>;
export type RoadmapDuration = z.infer<typeof roadmapDurationSchema>;

export function isActionableRoadmapTask(task: Pick<RoadmapTask, "title" | "description">): boolean {
    // Judge the complete instruction, not just a title's opening verb. A title
    // such as "Study retrieval and explain the pipeline" is already concrete,
    // and a short topic title may have its actual deliverable in the description.
    const instruction = `${task.title} ${task.description ?? ""}`;
    return /\b(read|watch|annotate|explain|summari[sz]e|write|build|implement|create|compare|test|evaluate|record|document|draw|diagram|list|identify|describe|outline|demonstrate|produce|design|debug|measure|calculate|deploy|configure|install|run|answer|solve|practice|revise|present|map|trace|refactor|benchmark|experiment|review)\b/i.test(instruction);
}

export function validateRoadmapContent(input: unknown, durationMonths: number): RoadmapContent {
    const duration = roadmapDurationSchema.parse(durationMonths);
    const parsed = roadmapContentSchema.safeParse(input);
    if (!parsed.success) {
        const raw = input as { weeks?: { title?: unknown; weekNumber?: unknown }[] } | undefined;
        throw new Error(`Invalid roadmap structure:\n${parsed.error.issues.map((issue) => {
            const weekIndex = issue.path[0] === "weeks" && typeof issue.path[1] === "number" ? issue.path[1] : null;
            const week = weekIndex !== null && Array.isArray(raw?.weeks) ? raw.weeks[weekIndex] : undefined;
            return `${weekIndex !== null ? `Week ${weekIndex + 1} (${String(week?.title ?? "untitled")}) ` : ""}${issue.path.join(".")}: ${issue.message}`;
        }).join("\n")}`);
    }
    const content = parsed.data;
    const errors: string[] = [];
    if (content.weeks.length !== duration * 4) errors.push(`A ${duration}-month roadmap must contain exactly ${duration * 4} weeks; received ${content.weeks.length}`);
    const ids = new Set<string>();
    const addId = (id: string, location: string) => { if (ids.has(id)) errors.push(`${location}: Duplicate roadmap identifier: ${id}`); ids.add(id); };
    const resourceIds = new Set(content.resources.map((resource) => resource.id));
    for (const resource of content.resources) {
        const location = `Resource "${resource.id}" (${resource.title})`;
        addId(resource.id, location);
        if (resource.origin === "uploaded" && (!resource.sourceId || resource.url)) errors.push(`${location}: Uploaded resources must reference a source ID without exposing storage URLs`);
        if (resource.origin === "web" && (!resource.url || resource.sourceId)) errors.push(`${location}: Web resources must have a verified URL and no uploaded source ID`);
        if (resource.url) {
            const url = new URL(resource.url);
            if (url.protocol !== "https:" && url.protocol !== "http:") errors.push(`${location}: Resource URL must use HTTP or HTTPS`);
            if (url.username || url.password) errors.push(`${location}: Resource URLs cannot contain credentials`);
        }
    }
    content.weeks.forEach((week, index) => {
        const location = `Week ${index + 1} (${week.title}, id "${week.id}")`;
        addId(week.id, location);
        if (week.weekNumber !== index + 1) errors.push(`${location}: weekNumber must be ${index + 1}, received ${week.weekNumber}`);
        if (!week.tasks.some((task) => task.kind === "practice")) errors.push(`${location}: Missing practical implementation or exercise (kind: practice)`);
        if (!week.tasks.some((task) => task.kind === "study")) errors.push(`${location}: Missing source-grounded study task (kind: study)`);
        for (const task of week.tasks) {
            const taskLocation = `${location}, task "${task.id}" (${task.title})`;
            addId(task.id, taskLocation);
            const unknown = task.resourceIds.filter((id) => !resourceIds.has(id));
            if (unknown.length) errors.push(`${taskLocation}: references unknown resource IDs [${unknown.join(", ")}]`);
            if (task.kind === "study" && task.resourceIds.length === 0) errors.push(`${taskLocation}: Study tasks must reference an available resource`);
            if (!isActionableRoadmapTask(task)) errors.push(`${taskLocation}: No concrete action or observable deliverable in title or description; specify what to read, explain, build, test or produce`);
        }
    });
    if (errors.length) throw new Error(`Invalid roadmap content. Fix ALL issues:\n${errors.join("\n")}`);
    return content;
}

export const roadmapAnalysisSchema = z.object({
    subject: text(300), learnerStartingPoint: text(1000),
    // Optional when reading analyses saved before source exclusions existed.
    excludedSources: z.array(z.object({ sourceId: text(160), reason: text(1000) }).strict()).max(100).optional(),
    topics: z.array(z.object({
        id: text(80), title: text(300), sourceIds: z.array(text(160)).max(100),
        prerequisiteIds: z.array(text(80)).max(20),
        difficulty: z.enum(["beginner", "intermediate", "advanced"]), essential: z.boolean(),
    }).strict()).min(2).max(30),
    // OpenAI structured output does not accept Zod's URL "uri" format. Candidate
    // strings are validated independently before any network request or catalog use.
    gaps: z.array(z.object({ topicId: text(80), reason: text(1000), searchQuery: text(300), candidateUrls: z.array(text(2000)).max(2) }).strict()).max(3),
}).strict();
export type RoadmapAnalysis = z.infer<typeof roadmapAnalysisSchema>;

export function validateRoadmapAnalysis(input: unknown, allowedSourceIds: readonly string[]): RoadmapAnalysis {
    const analysis = roadmapAnalysisSchema.parse(input);
    const errors: string[] = [];
    const topics = new Map(analysis.topics.map((topic) => [topic.id, topic]));
    if (topics.size !== analysis.topics.length) errors.push("Topic IDs must be unique");
    const allowed = new Set(allowedSourceIds);
    const covered = new Set(analysis.topics.flatMap((topic) => topic.sourceIds));
    const excluded = new Set<string>();
    for (const source of analysis.excludedSources ?? []) {
        if (!allowed.has(source.sourceId)) errors.push(`Excluded source "${source.sourceId}" is not a selected source`);
        if (excluded.has(source.sourceId)) errors.push(`Excluded source "${source.sourceId}" is duplicated`);
        if (covered.has(source.sourceId)) errors.push(`Source "${source.sourceId}" cannot be both covered by a topic and excluded`);
        excluded.add(source.sourceId);
    }
    for (const sourceId of allowed) {
        if (!covered.has(sourceId) && !excluded.has(sourceId)) errors.push(`Selected source "${sourceId}" was omitted from analysis. Attribute its actual evidenced topics, or explicitly exclude it with a reason if it contains no usable, relevant learning material. Never invent coverage.`);
    }
    for (const topic of analysis.topics) {
        const unknownSources = topic.sourceIds.filter((id) => !allowed.has(id));
        if (unknownSources.length) errors.push(`Topic "${topic.id}" (${topic.title}) references unknown source IDs [${unknownSources.join(", ")}]`);
    }
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (id: string, from?: string) => {
        if (visiting.has(id)) { errors.push(`Topic prerequisite cycle includes "${id}" (referenced by "${from ?? id}")`); return; }
        if (visited.has(id)) return;
        const topic = topics.get(id);
        if (!topic) { errors.push(`Unknown prerequisite topic "${id}" referenced by "${from ?? "unknown"}"`); return; }
        visiting.add(id); topic.prerequisiteIds.forEach((dependency) => visit(dependency, id)); visiting.delete(id); visited.add(id);
    };
    analysis.topics.forEach((topic) => visit(topic.id));
    for (const gap of analysis.gaps) {
        const topic = topics.get(gap.topicId);
        if (!topic) { errors.push(`Gap references unknown topic ID "${gap.topicId}"`); continue; }
        if (topic.sourceIds.length) errors.push(`Gap topic "${topic.id}" (${topic.title}) claims uploaded coverage from [${topic.sourceIds.join(", ")}]. A gap must be a distinct missing subtopic with sourceIds: [], or removed if the uploaded sources already cover it. Do not erase valid source attribution merely to satisfy this rule.`);
    }
    if (errors.length) throw new Error(`Invalid source analysis. Fix ALL issues:\n${errors.join("\n")}`);
    return analysis;
}

export function roadmapAnalysisPlannerSchema(sourceIds: string[]) {
    return z.object({
        subject: text(300), learnerStartingPoint: text(1000),
        excludedSources: sourceIds.length
            ? z.array(z.object({ sourceId: z.enum(sourceIds as [string, ...string[]]), reason: text(1000) }).strict()).max(100)
            : z.array(z.object({ sourceId: z.string(), reason: z.string() }).strict()).max(0),
        topics: z.array(z.object({
            title: text(300), sourceIds: sourceIds.length ? z.array(z.enum(sourceIds as [string, ...string[]])).max(100) : z.array(z.string()).max(0),
            prerequisiteIndexes: z.array(z.number().int().min(0).max(29)).max(20),
            difficulty: z.enum(["beginner", "intermediate", "advanced"]), essential: z.boolean(),
            gap: z.object({ reason: text(1000), searchQuery: text(300), candidateUrls: z.array(text(2000)).max(2) }).strict().nullable(),
        }).strict()).min(2).max(30),
    }).strict();
}

export function analysisPlannerToAnalysis(plan: z.infer<ReturnType<typeof roadmapAnalysisPlannerSchema>>): RoadmapAnalysis {
    return {
        subject: plan.subject, learnerStartingPoint: plan.learnerStartingPoint,
        excludedSources: plan.excludedSources,
        topics: plan.topics.map((topic, index) => ({
            id: `topic-${index + 1}`, title: topic.title, sourceIds: topic.sourceIds,
            prerequisiteIds: topic.prerequisiteIndexes.map((dependency) => `topic-${dependency + 1}`),
            difficulty: topic.difficulty, essential: topic.essential,
        })),
        gaps: plan.topics.flatMap((topic, index) => topic.gap ? [{ topicId: `topic-${index + 1}`, ...topic.gap }] : []),
    };
}

export function roadmapDraftSchema(weeks: number) {
    return z.object({
        title: text(300),
        weeks: z.array(z.object({
            weekNumber: z.number().int().min(1).max(12), title: text(300), objective: text(2000),
            topicIds: z.array(text(80)).min(1).max(20),
            tasks: z.array(z.object({
                title: text(600), description: text(2000).nullable(), resourceIds: z.array(text(160)).max(8),
                estimatedMinutes: z.number().int().min(5).max(1440).nullable(),
                kind: z.enum(["study", "practice", "revision"]),
            }).strict()).min(2).max(12),
            expectedOutcome: text(2000).nullable(),
        }).strict()).length(weeks),
    }).strict();
}

/** AI-facing output makes required task roles and allowed references structural,
 * rather than relying on the model to tag a free-form task array correctly. */
export function roadmapPlannerSchema(weeks: number, resourceIds: string[], topicIds: string[]) {
    if (!resourceIds.length || !topicIds.length) throw new Error("A planner requires verified resources and analyzed topics");
    const task = (needsResource: boolean) => z.object({
        title: text(600), description: text(2000).nullable(),
        resourceIds: z.array(z.enum(resourceIds as [string, ...string[]])).min(needsResource ? 1 : 0).max(8),
        estimatedMinutes: z.number().int().min(5).max(1440).nullable(),
    }).strict();
    return z.object({
        title: text(300),
        weeks: z.array(z.object({
            title: text(300), objective: text(2000),
            topicIds: z.array(z.enum(topicIds as [string, ...string[]])).min(1).max(20),
            studyTask: task(true),
            practiceTask: task(false),
            additionalTasks: z.array(task(false).extend({ kind: z.enum(["practice", "revision"]) })).min(1).max(3),
            expectedOutcome: text(2000).nullable(),
        }).strict()).length(weeks),
    }).strict();
}

export function plannerToDraft(plan: z.infer<ReturnType<typeof roadmapPlannerSchema>>): z.infer<ReturnType<typeof roadmapDraftSchema>> {
    return {
        title: plan.title,
        weeks: plan.weeks.map((week, index) => ({
            weekNumber: index + 1, title: week.title, objective: week.objective,
            topicIds: week.topicIds, expectedOutcome: week.expectedOutcome,
            tasks: [
                { ...week.studyTask, kind: "study" as const },
                { ...week.practiceTask, kind: "practice" as const },
                ...week.additionalTasks,
            ],
        })),
    };
}
