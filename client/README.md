# zehniq. client

Learn it. Understand it. Own it.

## Learning roadmaps

Open a workspace and choose **Generate Roadmap**. Select ready sources and a 1-, 2-, or 3-month duration to generate 4, 8, or 12 weekly milestones. The **Roadmaps** workspace tab keeps previous plans, saved task progress, and learning analytics. Regenerating creates a new plan rather than replacing completed work.

Resources open beside the timeline on desktop and in a resource tab on mobile. Original PDFs use an authenticated API proxy; websites retain an external-tab fallback when embedding is blocked. Learning analytics show persisted completion, weekly progress, recent activity, resource visits, and estimated effort. Roadmaps require sign-in and the running API/Inngest services; preview mode does not fabricate generated plans.

Backend configuration, API details, and verification are documented in `server/docs/roadmaps.md`.

A neo-brutalist learning workspace with light/dark themes. Built with Next.js,
React, TanStack Query, the AI SDK, and Better Auth.

## Run locally

1. From `client/`, run `pnpm install`.
2. Copy `.env.example` to `.env.local` if your backend is not at localhost:8081.
3. Start the backend from `server/` with `pnpm dev`.
4. Run `pnpm dev` from `client/`, then open http://localhost:3000.
5. For source/artifact processing, also run the backend's Inngest dev server.

`API_URL` is server-only and configures the Next.js `/api/*` rewrite. Secrets
belong in `server/.env`; no provider keys should be put in the client.

## Features

- Notebook creation, editing, deletion, search, grid/list views.
- Google sign-in through the existing Better Auth backend.
- PDF, website, YouTube, text and Markdown ingestion with status polling.
- Streaming source-grounded chat, history, citations, model selection, web search,
  stop-generation, and Markdown export.
- Summary, takeaway, flashcard, quiz, mind-map, and report viewers with JSON export.
- User memory management.
- Standalone Roadmap Builder at `/roadmaps`: direct source uploads, additional learning topics, or topics alone, with 1/2/3-month generation, saved progress, resource viewing, and analytics. Existing notebook roadmaps remain available separately in the sidebar.
- Responsive layouts, keyboard-friendly dialogs, reduced motion support, and a
  persisted light/dark theme.

TanStack Query owns live API data, mutations, invalidation, and status-aware
polling. AI SDK useChat manages the active response stream. Preview-only browser
state is kept separately and never written into the authenticated query cache.

Without a session, the interface offers a clearly labeled local preview. Preview
notebooks, notes, memories, and sample study artifacts persist in localStorage.
Preview chat is a labeled example, not a real AI response. Sign in for live AI,
PDF uploads, URL imports, and cloud memory. Preview sample artifacts are fixed
examples for learning the interface rather than live generation from new notes.

## Validation

Responsive layout checks cover 320, 375, 540, 750, 768, 820, 1024, and 1280 pixel widths. Phones and tablets use a navigation drawer and switch between Sources, Chat, and Studio. Roadmap resources use tabs on compact screens. Page-level horizontal overflow is contained, while code blocks and interactive viewers retain their own scrolling. Dialogs and artifact viewers were also checked with long titles and content.

`pnpm build` runs the production build and TypeScript checks. Browser QA covered
light/dark themes, notebook navigation, flashcards, quiz feedback, and responsive
workspace panels. OAuth and real provider operations require the backend and
credentials and were not exercised during UI preview QA.
