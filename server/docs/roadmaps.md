# Learning roadmaps

Zehniq builds a new source-grounded curriculum from selected ready workspace sources. Durations are restricted to 1, 2, or 3 months (4, 8, or 12 weekly milestones). Each generation creates an independent roadmap; task progress is never copied over or overwritten by generation.

## Running locally

Use the existing client, API, and Inngest dev server. Restart the API after applying the included Prisma migration and refresh/sync the Inngest app so `generate-roadmap` and its failure handler are registered. No additional service is required.

Server credentials remain in `.env`:

- `DATABASE_URL` for curriculum, completion states, and activity.
- `OPENAI_API_KEY` for structured source analysis and planning.
- Optional `ROADMAP_MODEL` selects the planner model; the default is `gpt-4o` for structured reasoning and curriculum validation.
- `TAVILY_API_KEY` for additional gap research. Without it, independently verified model-suggested resources can still be used, and the roadmap reports that search was unavailable.
- Existing Cloudinary configuration for authenticated original-PDF access. Cloudinary must permit delivery of the asset; signing cannot override every delivery restriction.

## Data and generation

`LearningRoadmap` stores duration, selected source IDs, status/phase, validated curriculum JSON, source analysis, and research limitations. `RoadmapTaskProgress` stores each task's current completion independently. `RoadmapActivity` records task transitions and resource opens for analytics. All three tables cascade when their workspace/roadmap is deleted.

The Inngest function executes source analysis, research, and curriculum planning as memoized steps. Source analysis fairly samples long sources with a bounded per-source/total input budget; it does not claim to read an unlimited corpus in one model call. The planner receives a consolidated prerequisite graph and a resource catalog. Final task/resource IDs are assigned or checked server-side. The validator enforces exact consecutive week counts, valid references, unique IDs, prerequisite order, practical exercises, study resources, and coverage of each selected upload. Invalid AI output receives a bounded repair attempt. A final job failure changes the roadmap to `failed`; retry is explicit.

The model can propose candidate URLs for uncovered topics. Those URLs and search results undergo public-address DNS checks, pinned requests, redirect revalidation, time/size bounds, readable-page/title checks, and topic relevance checks. Only verified candidates enter the curriculum catalog. Search failure or inconclusive verification is represented as a limitation, never a fabricated working link. Source and web text are treated as untrusted data in the prompts.

Every selected upload must be accounted for during analysis: it either has an evidenced topic or an explicit exclusion with a reason. Placeholder text, unreadable material, and unrelated content are excluded from lesson evidence and reported in the roadmap's source notes; uploaded files themselves remain available. A meaningful source omitted by the analyzer triggers a bounded analysis repair, rather than asking the curriculum planner to invent coverage. If no usable source or learning goal remains, generation stops with a clear explanation. Older memoized analyses with missing source attribution are reanalyzed before planning.

## API

Every endpoint below is under `/api/workspaces/:workspaceId/roadmaps` and requires an authenticated session plus workspace ownership:

- `GET /` lists saved roadmaps with derived progress.
- `POST /` accepts `{ durationMonths: 1 | 2 | 3, sourceIds: string[] }` and queues generation.
- `GET /:roadmapId` reads curriculum and current saved completion states.
- `PATCH /:roadmapId` renames with `{ title }`.
- `DELETE /:roadmapId` deletes the roadmap and its progress/activity.
- `POST /:roadmapId/retry` retries a failed generation.
- `PATCH /:roadmapId/tasks/:taskId` accepts `{ isCompleted: boolean }`.
- `GET /:roadmapId/analytics` returns computed analytics.
- `GET /:roadmapId/resources/:resourceId` resolves an authorized resource to readable content or a public external URL.
- `POST /:roadmapId/resources/:resourceId/open` records a resource visit without completing tasks.
- `GET /:roadmapId/resources/:resourceId/file` proxies an authorized uploaded PDF with private/no-store caching and same-origin framing.

Uploaded resources retain workspace source IDs, rather than private storage links. Each resource lookup verifies that the original source still belongs to the same workspace and is ready. Removed/unavailable sources produce a resource error without destroying the roadmap or completed tasks. PDF forwarding allows only the configured Cloudinary cloud, rejects redirects/non-PDF responses, and bounds file size and request time.

## Progress and analytics

Task weights are equal. Weekly/overall progress is completed tasks divided by current curriculum tasks, with zero-safe denominators. Parent-row locking and transactions serialize task changes and prevent duplicate events when the same completion state is sent twice. The client optimistically updates the checkbox and restores the previous cache on failure.

Analytics include completed/total tasks and weeks, per-week progress, resource visits, active days, current activity streak, and a 14-day activity history. Day boundaries are explicitly UTC. Estimated completed minutes sum curriculum estimates for completed tasks; this is planning effort, not a measurement of actual study time. Opening a source never marks a task complete.

## Resource viewing

The timeline remains mounted while a resource panel opens, so expanded weeks and timeline scroll position remain available. Desktop exposes an accessible split-width slider. Mobile switches between roadmap and resource tabs. Original PDFs use the authenticated proxy plus browser PDF page/zoom controls; browser PDF support varies. YouTube uses the supported embedded player. Websites retain a new-tab fallback and uploaded sources retain extracted text; CSP/frame restrictions are not bypassed.

## Standalone Roadmap Builder

The sidebar's **Roadmap Builder** opens `/roadmaps`. **Notebook roadmaps** retains the original notebook flow. Standalone paths use `RoadmapCollection` owned directly by the signed-in user; creating one never creates or requires a notebook. Both `Source` and `LearningRoadmap` support a collection owner with a null `workspaceId`. Source creation enforces exactly one owner. Standalone vector namespaces use `standalone:<collectionId>`; existing notebook namespaces are unchanged.

Users add PDFs, websites, YouTube videos, text, or Markdown directly to the path, and enter up to 20 learning topics. Generation accepts sources, topics, or both, with the same 1/2/3-month choices. Topics are learning goals, never claimed document evidence. Topic-only generation requires real verified web resources; if none are available, generation fails with an explanation asking the user to add a source or retry research.

Authenticated `/api/roadmaps/collections` endpoints list and create paths. `GET/PATCH/DELETE /:collectionId` read, rename, and remove a path. `/:collectionId/sources` supports text/Markdown creation, `/import/website`, `/import/youtube`, `/upload`, and `DELETE /:sourceId`. Ownership is checked before source processing. Final failed uploads use the existing cleanup job and disappear from the source list with UI feedback.

`/:collectionId/roadmaps` supports the same list, detail, rename, deletion, retry, task progress, analytics, resource, and authenticated PDF routes documented above. Standalone creation accepts `{ durationMonths: 1 | 2 | 3, sourceIds?: string[], topicGoals?: string[] }`. Each generation creates a separate plan with independent progress. The shared renderer and Inngest pipeline are reused through collection-specific authorization and source lookups. Notebook endpoints continue requiring selected notebook sources.

Apply `20261025T1101_standalone_roadmap_builder` in addition to the initial roadmap migration when setting up a new database. It adds collection ownership and learning topics, widening existing notebook ownership columns without removing notebook data.

## Verification commands

Run server tests with `pnpm exec tsx --test scripts/*.test.mjs` from `server`, server typecheck with `pnpm typecheck`, and client typecheck/build from `client`. Roadmap tests cover generation structure, prerequisite/resource integrity, source sampling, network restrictions, research failures, ownership, task persistence boundaries, derived analytics, PDF access, HTTP validation, and frontend progress/resource helpers.
