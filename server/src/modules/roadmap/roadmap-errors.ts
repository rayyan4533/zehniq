export const NO_VERIFIED_ROADMAP_RESOURCES = "No verified study resources were found. Add a source to this learning path or try again when web research is available.";
export const NO_USABLE_ROADMAP_SOURCES = "The selected sources don’t contain usable learning material. Replace them or add learning topics, then create a new roadmap.";

export function roadmapGenerationError(message: unknown): string {
    return message === NO_VERIFIED_ROADMAP_RESOURCES || message === NO_USABLE_ROADMAP_SOURCES
        ? message : "We couldn’t generate this roadmap. Please try again.";
}
