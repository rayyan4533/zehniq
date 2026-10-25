export type RoadmapDuration = 1 | 2 | 3;
export type RoadmapResource = {
  id: string; title: string; type: "pdf" | "youtube" | "website" | "text" | "markdown";
  origin: "uploaded" | "web"; sourceId?: string; url?: string; pageNumber?: number;
  timestampSeconds?: number; sectionTitle?: string; description?: string;
};
export type RoadmapTask = {
  id: string; title: string; description?: string; isCompleted: boolean;
  resourceIds: string[]; estimatedMinutes?: number; kind: "study" | "practice" | "revision";
};
export type RoadmapWeek = {
  id: string; weekNumber: number; title: string; objective: string; topics: string[];
  tasks: RoadmapTask[]; expectedOutcome?: string;
};
export type RoadmapProgress = { completedTasks: number; totalTasks: number; percent: number; currentWeek: number | null };
export type LearningRoadmap = {
  id: string; workspaceId: string | null; collectionId?: string | null; topicGoals?: string[]; title: string; durationMonths: RoadmapDuration;
  status: "generating" | "ready" | "failed"; phase: string; sourceIds: string[];
  weeks: RoadmapWeek[]; resources: RoadmapResource[]; limitations: string[];
  createdAt: string; updatedAt: string; generationError?: string; progress: RoadmapProgress;
};
export type RoadmapResourceView = RoadmapResource & { content?: string | null; pageCount?: number; filePath?: string };
export type RoadmapAnalytics = {
  completedTasks: number; totalTasks: number; percent: number; completedWeeks: number;
  totalWeeks: number; resourceOpens: number; activeDays: number; streakDays: number;
  estimatedMinutesCompleted: number; timezone: string;
  dailyActivity: { date: string; completedTasks: number; resourceOpens: number }[];
  weeklyProgress: { weekNumber: number; title: string; completedTasks: number; totalTasks: number; percent: number }[];
};

export function taskProgress(tasks: Pick<RoadmapTask, "isCompleted">[]) {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((task) => task.isCompleted).length;
  return { completedTasks, totalTasks, percent: totalTasks ? Math.round(completedTasks / totalTasks * 100) : 0 };
}

export function roadmapProgress(weeks: RoadmapWeek[]): RoadmapProgress {
  return { ...taskProgress(weeks.flatMap((week) => week.tasks)), currentWeek: weeks.find((week) => week.tasks.some((task) => !task.isCompleted))?.weekNumber ?? null };
}

export function toggleRoadmapTask(roadmap: LearningRoadmap, taskId: string, isCompleted: boolean): LearningRoadmap {
  const weeks = roadmap.weeks.map((week) => ({ ...week, tasks: week.tasks.map((task) => task.id === taskId ? { ...task, isCompleted } : task) }));
  return { ...roadmap, weeks, progress: roadmapProgress(weeks) };
}

export function safeResourceUrl(value?: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}

export function roadmapFileUrl(filePath?: string): string | null {
  return filePath && /^(?:\/workspaces|\/roadmaps\/collections)\/[^/?#]+\/roadmaps\/[^/?#]+\/resources\/[^/?#]+\/file$/.test(filePath)
    ? `/api${filePath}` : null;
}

export const durationChoices = [
  { months: 1 as const, weeks: 4, pace: "Intensive", description: "Focus on the essentials, with practical work every week." },
  { months: 2 as const, weeks: 8, pace: "Balanced", description: "Make time for concepts, implementation, and revision." },
  { months: 3 as const, weeks: 12, pace: "In-depth", description: "Go further with advanced topics, projects, and deeper practice." },
];

export function phaseLabel(phase: string): string {
  const labels: Record<string, string> = { queued: "Waiting to start", "source-analysis": "Understanding your sources", analyzing: "Understanding your sources", "gap-analysis": "Finding learning gaps", "web-research": "Researching supporting resources", researching: "Researching supporting resources", planning: "Planning your learning path", "curriculum-planning": "Planning your learning path", generating: "Building your weekly milestones", "structured-generation": "Building your weekly milestones", validating: "Checking your curriculum", saving: "Saving your roadmap", complete: "Ready to explore", ready: "Ready to explore", failed: "Generation needs another try" };
  return labels[phase] ?? "Building your roadmap";
}
