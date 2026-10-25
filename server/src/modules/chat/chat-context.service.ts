import { RAG_MIN_SCORE, RAG_TOP_K } from "../../lib/ai-config/ai-config.js";
import { embedTexts } from "../../lib/open-ai/openai.js";
import { queryWorkspaceVectors } from "../../lib/pinecone/pinecone.js";
import { findSourcesByWorkspaceId } from "../source/source.repo.js";
import { findChunksBySourceId } from "../source/source-chunk.repo.js";
import { ValidationError } from "../../types/app-error.js";

export type RetrievedChunk = {
    sourceId: string;
    sourceTitle: string;
    sourceType: string;
    chunkId: string;
    chunkIndex: number;
    page?: number;
    text: string;
    score: number;
};

const retrievalDependencies = { findSourcesByWorkspaceId, findChunksBySourceId, embedTexts, queryWorkspaceVectors };

export function createWorkspaceContextRetriever(deps = retrievalDependencies) {
    return async function retrieveWorkspaceContext(
        workspaceId: string,
        query: string,
        sourceIds?: string[],
    ): Promise<RetrievedChunk[]> {
        if (sourceIds?.length === 0) return [];
        const available = await deps.findSourcesByWorkspaceId(workspaceId, { status: "READY" });
        const requested = sourceIds ? new Set(sourceIds) : null;
        const sources = available.filter((source) => !requested || requested.has(source.id));
        if (requested && sources.length !== requested.size) {
            throw new ValidationError("Some selected sources are unavailable. Refresh your sources and try again.");
        }
        if (!sources.length) return [];
        const allowedIds = new Set(sources.map((source) => source.id));
        const [embedding] = await deps.embedTexts([query]);
        if (!embedding) throw new Error("No embedding returned for the query");
        const matches = await deps.queryWorkspaceVectors(workspaceId, embedding, RAG_TOP_K, [...allowedIds]);
        const relevant: RetrievedChunk[] = [];
        for (const match of matches) {
            const score = match.score ?? 0;
            if (score < RAG_MIN_SCORE) continue;
            const metadata = match.metadata as Record<string, unknown> | undefined;
            if (!metadata || typeof metadata.sourceId !== "string" || !allowedIds.has(metadata.sourceId) ||
                typeof metadata.sourceTitle !== "string" || typeof metadata.sourceType !== "string" ||
                typeof metadata.chunkId !== "string" || typeof metadata.text !== "string") continue;
            relevant.push({
                sourceId: metadata.sourceId, sourceTitle: metadata.sourceTitle,
                sourceType: metadata.sourceType, chunkId: metadata.chunkId,
                chunkIndex: Number(metadata.chunkIndex ?? 0),
                ...(typeof metadata.page === "number" ? { page: metadata.page } : {}),
                text: metadata.text.slice(0, 3000), score,
            });
        }
        // Broad questions like "summarize each source" may not resemble any chunk.
        // Always supply bounded excerpts from every selected source as well.
        const perSourceBudget = Math.min(3000, Math.floor(24000 / sources.length));
        const overviews = await Promise.all(sources.map(async (source) => {
            const chunks = await deps.findChunksBySourceId(source.id);
            const indexes = [...new Set([0, Math.floor(chunks.length / 2), chunks.length - 1])];
            const sample = indexes.map((index) => chunks[index]).filter((chunk) => chunk !== undefined);
            const excerptLength = Math.floor(perSourceBudget / Math.max(sample.length, 1));
            return sample.map((chunk): RetrievedChunk => {
                const metadata = chunk.metadata as Record<string, unknown> | null;
                return {
                    sourceId: source.id, sourceTitle: source.title, sourceType: source.type,
                    chunkId: chunk.id, chunkIndex: chunk.index,
                    text: chunk.content.slice(0, excerptLength), score: 0,
                    ...(typeof metadata?.page === "number" ? { page: metadata.page } : {}),
                };
            });
        }));
        const combined = new Map(relevant.map((chunk) => [chunk.chunkId, chunk]));
        for (const chunk of overviews.flat()) {
            if (!combined.has(chunk.chunkId)) combined.set(chunk.chunkId, chunk);
        }
        return [...combined.values()];
    };
}

export const retrieveWorkspaceContext = createWorkspaceContextRetriever();

export type UserMemoryContext = string;

export function buildChatSystemPrompt(input: {
    chunks: RetrievedChunk[];
    conversationSummary?: string | null;
    userMemories?: UserMemoryContext[];
    webSearchEnabled?: boolean;
}) {
    const sections: string[] = [
        "You are zehniq., an assistant that helps users learn from their workspace sources.",
        "The source excerpts supplied below are already extracted from the user's selected materials, including YouTube transcripts.",
        "Read the supplied excerpts directly. Do not claim you cannot access attachments or YouTube when their text is provided.",
        "Use source titles and types to identify what the user means by their website, PDF, or video lecture.",
        "For requests about each source, cover every distinct source represented in the context. Excerpts are samples, not necessarily the entire source.",
    ];

    if (input.webSearchEnabled) {
        sections.push(
            "You have access to a web_search tool for up-to-date information outside the workspace.",
            "Use it when the user asks about recent events or topics not covered by their sources.",
            "Cite web results inline using [W1], [W2], etc. matching the web result blocks.",
        );
    }

    if (input.userMemories?.length) {
        const memoryBlock = input.userMemories
            .map((memory) => `- ${memory}`)
            .join("\n");

        sections.push(
            "Known facts about this user (use when relevant):",
            memoryBlock,
        );
    }

    const summary = input.conversationSummary?.trim();
    if (summary) {
        sections.push("Earlier conversation summary:", summary);
    }

    if (input.chunks.length === 0) {
        sections.push(
            "No source excerpts were supplied for this request. Sources may be unselected, still processing, or unavailable.",
            input.webSearchEnabled
                ? "Use web search when needed, or answer from general knowledge."
                : "Answer helpfully from general knowledge and suggest adding or processing sources when appropriate.",
            "Do not invent citations.",
        );
        return sections.join("\n");
    }

    const context = input.chunks
        .map((chunk, index) => {
            const label = `[${index + 1}] ${chunk.sourceTitle} (${chunk.sourceType})${
                chunk.page ? `, page ${chunk.page}` : ""
            }`;
            return `${label}\n${chunk.text}`;
        })
        .join("\n\n");

    sections.push(
        "Use ONLY the retrieved context below when making factual claims about their materials.",
        "If the context is insufficient, say so clearly.",
        "Cite sources inline using [1], [2], etc. matching the numbered context blocks.",
        "Keep answers concise, accurate, and educational.",
        "",
        "Retrieved context:",
        context,
    );

    return sections.join("\n");
}
