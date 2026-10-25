import type { RoadmapContent } from "./roadmap.schema.js";

export type ProgressState = { taskId: string; isCompleted: boolean };
export type ActivityState = { kind: string; taskId?: string | null; resourceId?: string | null; createdAt: unknown };

export function roadmapProgress(weeks: RoadmapContent["weeks"], states: ProgressState[]) {
    const completed = new Set(states.filter((row) => row.isCompleted).map((row) => row.taskId));
    const tasks = weeks.flatMap((week) => week.tasks);
    const completedTasks = tasks.filter((task) => completed.has(task.id)).length;
    return {
        completedTasks, totalTasks: tasks.length,
        percent: tasks.length ? Math.round(completedTasks / tasks.length * 100) : 0,
        currentWeek: weeks.find((week) => week.tasks.some((task) => !completed.has(task.id)))?.weekNumber ?? null,
    };
}

export function roadmapAnalytics(weeks: RoadmapContent["weeks"], states: ProgressState[], activity: ActivityState[], now = new Date()) {
    const completed = new Set(states.filter((row) => row.isCompleted).map((row) => row.taskId));
    const weeklyProgress = weeks.map((week) => {
        const completedTasks = week.tasks.filter((task) => completed.has(task.id)).length;
        return { weekNumber: week.weekNumber, title: week.title, completedTasks, totalTasks: week.tasks.length, percent: week.tasks.length ? Math.round(completedTasks / week.tasks.length * 100) : 0 };
    });
    const daily = new Map<string, { completed: Set<string>; resourceOpens: number }>();
    for (const item of activity) {
        const timestamp = new Date(String(item.createdAt));
        if (!Number.isFinite(timestamp.getTime())) continue;
        const date = timestamp.toISOString().slice(0, 10);
        const entry = daily.get(date) ?? { completed: new Set<string>(), resourceOpens: 0 };
        if (item.kind === "task_completed" && item.taskId) entry.completed.add(item.taskId);
        if (item.kind === "resource_opened") entry.resourceOpens += 1;
        daily.set(date, entry);
    }
    const day = (offset: number) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset)).toISOString().slice(0, 10);
    let streakDays = 0;
    let offset = daily.has(day(0)) ? 0 : -1;
    while (daily.has(day(offset))) { streakDays += 1; offset -= 1; }
    return {
        ...roadmapProgress(weeks, states),
        completedWeeks: weeklyProgress.filter((week) => week.totalTasks > 0 && week.completedTasks === week.totalTasks).length,
        totalWeeks: weeks.length,
        resourceOpens: activity.filter((item) => item.kind === "resource_opened").length,
        activeDays: daily.size,
        streakDays,
        estimatedMinutesCompleted: weeks.flatMap((week) => week.tasks).filter((task) => completed.has(task.id)).reduce((sum, task) => sum + (task.estimatedMinutes ?? 0), 0),
        dailyActivity: Array.from({ length: 14 }, (_, index) => {
            const date = day(index - 13); const entry = daily.get(date);
            return { date, completedTasks: entry?.completed.size ?? 0, resourceOpens: entry?.resourceOpens ?? 0 };
        }),
        weeklyProgress,
        timezone: "UTC" as const,
    };
}
