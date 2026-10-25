import type { Source } from "./notebook";
import type { LearningRoadmap } from "./roadmap";

export type RoadmapCollection = { id: string; title: string; createdAt: string; updatedAt: string; sources?: Source[]; sourceCount?: number; roadmaps?: LearningRoadmap[]; topicGoals?: string[] };

export function parseTopicGoals(value: string): string[] {
  const goals = [...new Set(value.split(/[\n,]/).map((topic) => topic.trim()).filter(Boolean))];
  if (goals.length > 20) throw new Error("Choose up to 20 additional topics.");
  if (goals.some((topic) => topic.length > 200)) throw new Error("Keep each topic name under 200 characters.");
  return goals;
}
