import { db } from "../../prisma/db.js";

export function listCollections(userId: string) {
    return db.orm.public.RoadmapCollection.where({ userId }).orderBy((row) => row.updatedAt.desc()).all();
}
export function findCollection(id: string, userId: string) {
    return db.orm.public.RoadmapCollection.where({ id, userId }).first();
}
export function createCollection(userId: string, title: string) {
    return db.orm.public.RoadmapCollection.create({ userId, title });
}
export function renameCollection(id: string, title: string) {
    return db.orm.public.RoadmapCollection.where({ id }).update({ title });
}
export async function deleteCollection(id: string) {
    await db.orm.public.RoadmapCollection.where({ id }).delete();
}
export function collectionSources(collectionId: string) {
    return db.orm.public.Source.where({ collectionId }).orderBy((row) => row.createdAt.desc()).all();
}
export function findCollectionSource(id: string, collectionId: string) {
    return db.orm.public.Source.where({ id, collectionId }).first();
}
export function collectionRoadmaps(collectionId: string) {
    return db.orm.public.LearningRoadmap.where({ collectionId }).orderBy((row) => row.createdAt.desc()).all();
}
export function collectionDefaults(collectionId: string) {
    return db.orm.public.LearningRoadmap.where({ collectionId }).orderBy((row) => row.createdAt.desc()).select("topicGoals").first();
}
export function findCollectionRoadmap(id: string, collectionId: string) {
    return db.orm.public.LearningRoadmap.where({ id, collectionId }).first();
}
export function createCollectionRoadmap(input: { collectionId: string; title: string; durationMonths: number; sourceIds: string[]; topicGoals: string[] }) {
    return db.orm.public.LearningRoadmap.create({ ...input, status: "generating", phase: "analyzing" });
}
