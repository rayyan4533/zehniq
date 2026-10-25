"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  useMutation,
  useQuery,
  useQueries,
  useQueryClient,
} from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useTheme } from "next-themes";
import {
  ArrowUpRight,
  Plus,
  Search,
  Sun,
  Moon,
  LayoutGrid,
  List,
  BookOpen,
  Sparkles,
  Settings2,
  X,
  Brain,
  LogOut,
  Clock3,
  Trash2,
  FileText,
  Link2,
  Play,
  Check,
  CheckCircle2,
  LoaderCircle,
  ArrowLeft,
  MoreHorizontal,
  NotebookPen,
  ExternalLink,
  RefreshCw,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  Route,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { api } from "@/lib/api";
import { sourceEmbedUrl } from "@/lib/source-embed";
import {
  demoWorkspaces,
  demoSources,
  demoContent,
  tools,
  type Workspace,
  type Source,
  type Artifact,
  type ArtifactType,
  type Memory,
} from "@/lib/notebook";
import { Modal, NotebookArt, ToolIcon } from "./primitives";
import { ArtifactViewer } from "./artifact-viewer";
import { ChatPanel } from "./chat-panel";
import { SourceForm, WorkspaceForm, MemoryPanel } from "./forms";
import { RoadmapPanel } from "./roadmap-panel";
import { StandaloneRoadmaps } from "./standalone-roadmaps";
const storageKey = "notebook-road-preview-v1";
const sourceIcons = {
  PDF: FileText,
  WEBSITE: Link2,
  YOUTUBE: Play,
  TEXT: FileText,
  MARKDOWN: NotebookPen,
};

export function NotebookApp({
  initialWorkspaceId,
  initialLogin = false,
  standaloneRoadmaps = false,
}: {
  initialWorkspaceId?: string;
  initialLogin?: boolean;
  standaloneRoadmaps?: boolean;
}) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const live = !!session?.user;
  const queryClient = useQueryClient();
  const [previewWorkspaces, setPreviewWorkspaces] =
    useState<Workspace[]>(demoWorkspaces);
  const [previewSources, setPreviewSources] = useState<Source[]>(demoSources);
  const [previewArtifacts, setPreviewArtifacts] = useState<Artifact[]>([]);
  const [ready, setReady] = useState(false);
  const [search, setSearch] = useState("");
  const [layout, setLayout] = useState("grid");
  const [filter, setFilter] = useState("all");
  const [modal, setModal] = useState<
    "create" | "source" | "memory" | "settings" | "login" | "roadmaps" | null
  >(initialLogin ? "login" : null);
  const [editing, setEditing] = useState<Workspace | null>(null);
  const [viewArtifact, setViewArtifact] = useState<Artifact | null>(null);
  const [viewSource, setViewSource] = useState<Source | null>(null);
  const [originalSourceId, setOriginalSourceId] = useState<string | null>(null);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [rightSection, setRightSection] = useState<"studio" | "source" | null>("studio");
  useEffect(() => {
    const compact = window.matchMedia("(max-width: 1000px)");
    const syncSidebar = () => setSidebarHidden(compact.matches);
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && compact.matches) setSidebarHidden(true); };
    syncSidebar();
    compact.addEventListener("change", syncSidebar);
    document.addEventListener("keydown", closeOnEscape);
    return () => { compact.removeEventListener("change", syncSidebar); document.removeEventListener("keydown", closeOnEscape); };
  }, []);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [mobileTab, setMobileTab] = useState("chat");
  const [workspaceMode, setWorkspaceMode] = useState<"notebook" | "roadmaps">("notebook");
  const [roadmapPickerAction, setRoadmapPickerAction] = useState<"browse" | "create">("browse");
  const [roadmapCreateRequest, setRoadmapCreateRequest] = useState(0);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (initialWorkspaceId && url.searchParams.get("view") === "roadmaps") {
      setWorkspaceMode("roadmaps");
      if (url.searchParams.get("create") === "roadmap") {
        setRoadmapCreateRequest((value) => value + 1);
        url.searchParams.delete("create");
        window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
      }
    }
  }, [initialWorkspaceId]);
  const [selected, setSelected] = useState<string[]>([]);
  const sourceSelection = useRef({ scope: "", ready: new Set<string>() });
  const [previewMemories, setPreviewMemories] = useState<Memory[]>([]);
  const account = session?.user.id ?? "preview";
  const workspaceKey = ["notebooks", account];
  const sourceKey = ["sources", account, initialWorkspaceId];
  const artifactKey = ["artifacts", account, initialWorkspaceId];
  const memoryKey = ["memories", account];
  const notebooksQuery = useQuery({
    queryKey: workspaceKey,
    queryFn: () => api<Workspace[]>("/workspaces"),
    enabled: live,
  });
  const sourceQuery = useQuery({
    queryKey: sourceKey,
    queryFn: () => api<Source[]>(`/workspaces/${initialWorkspaceId}/sources`),
    enabled: live && !!initialWorkspaceId,
    refetchInterval: (query) =>
      query.state.data?.some(
        (s) => s.status === "PENDING" || s.status === "PROCESSING",
      )
        ? 3000
        : false,
  });
  const pendingSources = useRef<{ key: string; items: Source[] }>({ key: "", items: [] });
  useEffect(() => {
    const key = `${account}:${initialWorkspaceId}`;
    if (pendingSources.current.key !== key) pendingSources.current = { key, items: [] };
    if (!live || !sourceQuery.data || !sourceQuery.isSuccess) return;
    const current = sourceQuery.data;
    const removed = pendingSources.current.items.filter((previous) =>
      !current.some((source) => source.id === previous.id),
    );
    if (removed.length) {
      setError(`Source upload failed: ${removed.map((source) => source.title).join(", ")}. Please upload again.`);
      const ids = new Set(removed.map((source) => source.id));
      setSelected((items) => items.filter((id) => !ids.has(id)));
      setViewSource((source) => source && ids.has(source.id) ? null : source);
    }
    pendingSources.current.items = current.filter((source) =>
      source.status === "PENDING" || source.status === "PROCESSING",
    );
  }, [account, initialWorkspaceId, live, sourceQuery.data, sourceQuery.isSuccess]);
  const artifactQuery = useQuery({
    queryKey: artifactKey,
    queryFn: () =>
      api<Artifact[]>(`/workspaces/${initialWorkspaceId}/artifacts`),
    enabled: live && !!initialWorkspaceId,
    refetchInterval: (query) =>
      query.state.data?.some(
        (a) => a.status === "PENDING" || a.status === "PROCESSING",
      )
        ? 3000
        : false,
  });
  const memoryQuery = useQuery({
    queryKey: memoryKey,
    queryFn: () => api<Memory[]>("/memory"),
    enabled: live && modal === "memory",
  });
  const workspaces = live ? (notebooksQuery.data ?? []) : previewWorkspaces;
  const sources = live ? (sourceQuery.data ?? []) : previewSources;
  const artifacts = live ? (artifactQuery.data ?? []) : previewArtifacts;
  const memories = live ? (memoryQuery.data ?? []) : previewMemories;
  const overviews = useQueries({
    queries: (live && !initialWorkspaceId && !standaloneRoadmaps ? workspaces : []).map((w) => ({
      queryKey: ["overview", account, w.id],
      queryFn: async () => {
        const [sources, artifacts] = await Promise.all([
          api<Source[]>(`/workspaces/${w.id}/sources`),
          api<Artifact[]>(`/workspaces/${w.id}/artifacts`),
        ]);
        return { workspaceId: w.id, sources, artifacts };
      },
    })),
  });
  const sourceCount = live
    ? overviews.reduce((sum, q) => sum + (q.data?.sources.length ?? 0), 0)
    : sources.length;
  const artifactCount = live
    ? overviews.reduce((sum, q) => sum + (q.data?.artifacts.length ?? 0), 0)
    : artifacts.length;
  const sourceCountFor = (id: string) =>
    live
      ? (overviews.find((q) => q.data?.workspaceId === id)?.data?.sources
        .length ?? "—")
      : sources.filter((s) => s.workspaceId === id).length;

  type Update<T> = T[] | ((items: T[]) => T[]);
  function setWorkspaces(update: Update<Workspace>) {
    if (live)
      queryClient.setQueryData<Workspace[]>(workspaceKey, (old) =>
        typeof update === "function" ? update(old ?? []) : update,
      );
    else setPreviewWorkspaces(update);
  }
  function setSources(update: Update<Source>) {
    if (live)
      queryClient.setQueryData<Source[]>(sourceKey, (old) =>
        typeof update === "function" ? update(old ?? []) : update,
      );
    else setPreviewSources(update);
  }
  function setArtifacts(update: Update<Artifact>) {
    if (live)
      queryClient.setQueryData<Artifact[]>(artifactKey, (old) =>
        typeof update === "function" ? update(old ?? []) : update,
      );
    else setPreviewArtifacts(update);
  }
  function setMemories(update: Update<Memory>) {
    if (live)
      queryClient.setQueryData<Memory[]>(memoryKey, (old) =>
        typeof update === "function" ? update(old ?? []) : update,
      );
    else setPreviewMemories(update);
  }
  const workspace = workspaces.find((w) => w.id === initialWorkspaceId);
  const wsSources = sources.filter((s) => s.workspaceId === initialWorkspaceId);
  const wsArtifacts = artifacts.filter(
    (a) => a.workspaceId === initialWorkspaceId,
  );
  const selectedSources = wsSources.filter(
    (s) => selected.includes(s.id) && s.status === "READY",
  );
  const mutation = useMutation({
    mutationFn: (action: () => Promise<void>) => action(),
    onSettled: () => {
      if (live) {
        queryClient.invalidateQueries({ queryKey: ["overview", account] });
        queryClient.invalidateQueries({ queryKey: workspaceKey });
        queryClient.invalidateQueries({ queryKey: sourceKey });
        queryClient.invalidateQueries({ queryKey: artifactKey });
        queryClient.invalidateQueries({ queryKey: memoryKey });
      }
    },
  });
  const notify = useCallback((message: string) => {
    setToast(message);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const data = JSON.parse(saved);
        setPreviewWorkspaces(data.workspaces ?? demoWorkspaces);
        setPreviewSources(data.sources ?? demoSources);
        setPreviewArtifacts(data.artifacts ?? []);
        setPreviewMemories(data.memories ?? []);
      }
    } catch { }
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready && !live)
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          workspaces: previewWorkspaces,
          sources: previewSources,
          artifacts: previewArtifacts,
          memories: previewMemories,
        }),
      );
  }, [
    ready,
    live,
    previewWorkspaces,
    previewSources,
    previewArtifacts,
    previewMemories,
  ]);
  useEffect(() => {
    const readyIds = sources
      .filter(
        (s) => s.workspaceId === initialWorkspaceId && s.status === "READY",
      )
      .map((s) => s.id);
    const scope = `${account}:${initialWorkspaceId}`;
    const previous = sourceSelection.current;
    const ready = new Set(readyIds);
    setSelected((current) => previous.scope !== scope ? readyIds : [
      ...current.filter((id) => ready.has(id)),
      ...readyIds.filter((id) => !previous.ready.has(id)),
    ]);
    sourceSelection.current = { scope, ready };
  }, [account, initialWorkspaceId, sourceQuery.data, previewSources]);
  useEffect(() => {
    if (!viewSource) return;
    const current = sources.find((source) => source.id === viewSource.id);
    if (current && current !== viewSource) setViewSource(current);
  }, [sources, viewSource]);
  const embeddedUrl = viewSource ? sourceEmbedUrl(viewSource) : null;
  const showingOriginal = !!embeddedUrl && originalSourceId === viewSource?.id;
  const activeArtifact = viewArtifact
    ? (artifacts.find((a) => a.id === viewArtifact.id) ?? viewArtifact)
    : null;
  const queryError =
    notebooksQuery.error ??
    sourceQuery.error ??
    artifactQuery.error ??
    memoryQuery.error;
  const [dismissedQueryError, setDismissedQueryError] = useState("");
  function closeModal() {
    setModal(null);
    setEditing(null);
    setError("");
    setRoadmapPickerAction("browse");
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await mutation.mutateAsync(action);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function saveWorkspace(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await run(async () => {
      const input = {
        title: String(form.get("title")),
        description: String(form.get("description")),
        icon: String(form.get("icon") || "✳"),
        defaultModel: String(form.get("defaultModel") || "gpt-4o-mini"),
      };
      if (editing) {
        const result = live
          ? await api<Workspace>(`/workspaces/${editing.id}`, {
            method: "PATCH",
            body: JSON.stringify(input),
          })
          : { ...editing, ...input };
        setWorkspaces((items) =>
          items.map((w) => (w.id === result.id ? result : w)),
        );
        notify("Notebook updated. Make it yours.");
      } else {
        const result = live
          ? await api<Workspace>("/workspaces", {
            method: "POST",
            body: JSON.stringify(input),
          })
          : {
            ...input,
            id: `demo-${crypto.randomUUID()}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        setWorkspaces((items) => [result, ...items]);
        notify("A fresh page for your next big idea.");
      }
      closeModal();
    });
  }
  async function deleteWorkspace(w: Workspace) {
    if (!confirm(`Delete “${w.title}” and everything in it?`)) return;
    await run(async () => {
      if (live) await api(`/workspaces/${w.id}`, { method: "DELETE" });
      setWorkspaces((items) => items.filter((x) => x.id !== w.id));
      if (initialWorkspaceId === w.id) router.push("/");
      closeModal();
      notify("Notebook deleted.");
    });
  }
  async function deleteSource(source: Source) {
    if (!confirm(`Delete "${source.title}"?`)) return;
    await run(async () => {
      if (live) await api(`/workspaces/${source.workspaceId}/sources/${source.id}`, { method: "DELETE" });
      pendingSources.current.items = pendingSources.current.items.filter((item) => item.id !== source.id);
      setSources((items) => items.filter((item) => item.id !== source.id));
      setSelected((items) => items.filter((id) => id !== source.id));
      setViewSource((current) => current?.id === source.id ? null : current);
      setOriginalSourceId((id) => id === source.id ? null : id);
      notify("Source deleted.");
    });
  }
  async function addSource(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const type = String(form.get("type"));
    await run(async () => {
      try {
        let result: Source;
        const title = String(form.get("title") || "");
        if (live) {
          if (type === "PDF") {
            const file = form.get("file") as File;
            if (!file?.size) throw new Error("Choose a PDF first.");
            if (file.size > 10 * 1024 * 1024)
              throw new Error("PDF files must be 10 MB or smaller.");
            const body = new FormData();
            body.append("file", file);
            if (title) body.append("title", title);
            result = await api<Source>(
              `/workspaces/${initialWorkspaceId}/sources/upload`,
              { method: "POST", body },
            );
          } else if (type === "WEBSITE" || type === "YOUTUBE") {
            result = await api<Source>(
              `/workspaces/${initialWorkspaceId}/sources/import/${type.toLowerCase()}`,
              {
                method: "POST",
                body: JSON.stringify({
                  url: form.get("url"),
                  ...(title ? { title } : {}),
                }),
              },
            );
          } else {
            result = await api<Source>(
              `/workspaces/${initialWorkspaceId}/sources`,
              {
                method: "POST",
                body: JSON.stringify({
                  type,
                  title,
                  content: form.get("content"),
                }),
              },
            );
          }
        } else {
          if (type !== "TEXT" && type !== "MARKDOWN")
            throw new Error(
              "Sign in for file and URL imports. Try text or Markdown in preview mode.",
            );
          result = {
            id: crypto.randomUUID(),
            workspaceId: initialWorkspaceId!,
            title,
            type,
            content: String(form.get("content")),
            status: "READY",
          };
        }
        setSources((items) => [...items, result]);
        closeModal();
        notify(
          live
            ? "Source added. Processing will begin shortly."
            : "Source saved to this browser.",
        );
      } catch (error) {
        throw new Error(`Source upload failed. ${error instanceof Error ? error.message : "Please try again."}`);
      }
    });
  }
  async function generate(type: ArtifactType) {
    if (busy) return;
    if (!selectedSources.length) {
      notify("Add a ready source first.");
      return;
    }
    const tool = tools.find((t) => t.type === type)!;
    const requestId = `request-${crypto.randomUUID()}`;
    setViewArtifact({ id: requestId, workspaceId: initialWorkspaceId!, type, title: `${tool.label} · ${workspace?.title}`, status: "REQUESTING", sourceIds: selectedSources.map((source) => source.id), content: null });
    await run(async () => {
      try {
        const result = live
          ? await api<Artifact>(`/workspaces/${initialWorkspaceId}/artifacts`, {
            method: "POST",
            body: JSON.stringify({
              type,
              sourceIds: selectedSources.map((s) => s.id),
            }),
          })
          : {
            id: crypto.randomUUID(),
            workspaceId: initialWorkspaceId!,
            type,
            title: `${tool.label} · ${workspace?.title}`,
            status: "READY",
            sourceIds: selectedSources.map((s) => s.id),
            content: demoContent(type, selectedSources),
          };
        setArtifacts((items) => [result, ...items]);
        setViewArtifact((current) => current?.id === requestId ? result : current);
        if (!live) notify("Sample study material · preview only");
      } catch (error) {
        setViewArtifact((current) => current?.id === requestId ? null : current);
        throw error;
      }
    });
  }
  const filtered = workspaces
    .filter((w) =>
      (w.title + " " + w.description)
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .filter(
      (w) =>
        filter !== "recent" ||
        Date.now() - new Date(w.updatedAt).getTime() < 7 * 86400000,
    );
  return (
    <div className={`app-shell ${sidebarHidden ? "sidebar-hidden" : ""}`}>
      <header className="topbar">
        {sidebarHidden && (
          <button className="icon-button sidebar-toggle" aria-label="Show sidebar" aria-expanded={false} aria-controls="main-sidebar" onClick={() => setSidebarHidden(false)}>
            <PanelLeftOpen size={20} />
          </button>
        )}
        <button
          className="brand"
          onClick={() => router.push("/")}
          aria-label="zehniq. home"
        >
          <span className="brand-mark">
            <Image className="brand-icon-light" src="/notebook-roadlm-favicon-light.png" alt="" width={44} height={44} />
            <Image className="brand-icon-dark" src="/notebook-roadlm-favicon-dark.png" alt="" width={44} height={44} />
          </span>
          <span>
            zehniq<span className="brand-road">.</span>
          </span>
        </button>
        <div className="topbar-divider" />
        <span className="topbar-caption">
          Learn it. Understand it. Own it.
        </span>
        <div className="topbar-actions">
          <span className="preview-badge">
            <span className={live ? "status-dot online" : "status-dot"} />
            {live ? "Your workspace" : "PREVIEW MODE"}
          </span>
          <button
            className="icon-button theme-toggle"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle light and dark theme"
          >
            <Sun className="sun-icon" size={19} />
            <Moon className="moon-icon" size={19} />
          </button>
          <button
            className="profile-button"
            onClick={() => setModal(live ? "memory" : "login")}
            title={live ? session.user.name : "Sign in"}
          >
            {live ? session.user.name?.slice(0, 1) || "Y" : "Y"}
          </button>
        </div>
      </header>
      <div className="body-layout">
        {!sidebarHidden && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setSidebarHidden(true)} />}
        <aside id="main-sidebar" className="main-sidebar">
          <div className="sidebar-controls">
            <button className="icon-button sidebar-toggle" aria-label="Hide sidebar" aria-expanded={true} aria-controls="main-sidebar" onClick={() => setSidebarHidden(true)}>
              <PanelLeftClose size={20} />
            </button>
          </div>
          <div className="sidebar-section-label">
            YOUR CORNER OF THE INTERNET
          </div>
          <button
            className={`nav-item ${!initialWorkspaceId && !standaloneRoadmaps ? "active" : ""}`}
            onClick={() => { router.push("/"); if (window.matchMedia("(max-width: 1000px)").matches) setSidebarHidden(true); }}
          >
            <LayoutGrid size={19} /> My notebooks{" "}
            <span>{workspaces.length}</span>
          </button>
          <button
            className={`nav-item ${modal === "memory" ? "active" : ""}`}
            onClick={() => setModal("memory")}
          >
            <Brain size={19} /> Memory <span className="tiny-new">NEW</span>
          </button>
          <button className={`nav-item ${standaloneRoadmaps ? "active" : ""}`} aria-current={standaloneRoadmaps ? "page" : undefined} onClick={() => { router.push("/roadmaps"); if (window.matchMedia("(max-width: 1000px)").matches) setSidebarHidden(true); }}><Route size={19} /> Roadmap Builder</button>
          <button
            className={`nav-item ${modal === "roadmaps" || (initialWorkspaceId && workspaceMode === "roadmaps") ? "active" : ""}`}
            aria-pressed={modal === "roadmaps" || (!!initialWorkspaceId && workspaceMode === "roadmaps")}
            onClick={() => {
              if (initialWorkspaceId) setWorkspaceMode("roadmaps");
              else setModal("roadmaps");
              if (window.matchMedia("(max-width: 1000px)").matches) setSidebarHidden(true);
            }}
          >
            <Route size={19} /> Notebook roadmaps
          </button>
          <div className="sidebar-rule" />
          <div className="sidebar-section-label sidebar-row">
            NOTEBOOKS{" "}
            <button
              aria-label="Create notebook"
              onClick={() => {
                setEditing(null);
                setModal("create");
              }}
            >
              <Plus size={16} />
            </button>
          </div>
          <div className="sidebar-notebooks">
            {workspaces.map((w, i) => (
              <button
                key={w.id}
                className={`notebook-link ${initialWorkspaceId === w.id ? "selected" : ""}`}
                onClick={() => { router.push(`/workspace/${w.id}`); if (window.matchMedia("(max-width: 1000px)").matches) setSidebarHidden(true); }}
              >
                <span className={`mini-icon tone-${i % 3}`}>
                  {w.icon || "✳"}
                </span>
                <span>{w.title}</span>
              </button>
            ))}
          </div>
          <div className="sidebar-bottom">
            <div className="curiosity-note">
              <span>↗</span>
              <p>
                Stay curious.
                <br />
                <strong>Take the scenic route.</strong>
              </p>
              <i>✳</i>
            </div>
            <button
              className="nav-item"
              onClick={() => {
                if (workspace) {
                  setEditing(workspace);
                  setModal("settings");
                } else setModal(live ? "memory" : "login");
              }}
            >
              <Settings2 size={18} />{" "}
              {workspace ? "Notebook settings" : "Account & preferences"}
            </button>
            {live && (
              <button
                className="nav-item"
                onClick={() =>
                  authClient.signOut().then(() => location.assign("/"))
                }
              >
                <LogOut size={17} /> Sign out
              </button>
            )}
            <div className="sidebar-footer">
              <span>MADE FOR YOUR MIND.</span>
              <span>© 2026</span>
            </div>
          </div>
        </aside>
        <main
          className={`main-content ${initialWorkspaceId ? "workspace-content" : ""}`}
        >
          {standaloneRoadmaps ? <StandaloneRoadmaps account={account} live={live} onSignIn={() => setModal("login")} /> : !initialWorkspaceId ? (
            <>
              <div className="breadcrumb">
                <span>YOUR SPACE</span>
                <span> / </span>
                <strong>MY NOTEBOOKS</strong>
                <span className="date-label">
                  {new Date()
                    .toLocaleDateString("en", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                    .toUpperCase()}
                </span>
              </div>
              <section className="welcome-hero">
                <div className="hero-copy">
                  <span className="hero-tag">
                    <span /> A HOME FOR YOUR WHAT-IFS
                  </span>
                  <h1>
                    Big ideas.
                    <br />
                    Meet your <span>new home.</span>
                    <svg viewBox="0 0 360 16" aria-hidden="true">
                      <path d="M3 11 Q145 -1 356 8 M10 15 Q190 5 342 13" />
                    </svg>
                  </h1>
                  <p>
                    Learn it. Understand it. Own it.
                  </p>
                  <button
                    className="button primary"
                    onClick={() => setModal("create")}
                  >
                    <Plus size={18} /> Create a notebook{" "}
                    <ArrowUpRight size={18} />
                  </button>
                </div>
                <NotebookArt />
              </section>
              <div className="stats-strip">
                <div>
                  <span className="stat-icon pink">
                    <BookOpen size={19} />
                  </span>
                  <strong>
                    {workspaces.length.toString().padStart(2, "0")}
                  </strong>
                  <span>notebooks, endless possibilities</span>
                </div>
                <div>
                  <span className="stat-icon green">
                    <FileText size={19} />
                  </span>
                  <strong>{sourceCount.toString().padStart(2, "0")}</strong>
                  <span>sources of inspiration</span>
                </div>
                <div>
                  <span className="stat-icon purple">
                    <Sparkles size={19} />
                  </span>
                  <strong>{artifactCount.toString().padStart(2, "0")}</strong>
                  <span>ideas brought to life</span>
                </div>
              </div>
              <section className="notebooks-section">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">COLLECT. CONNECT. CREATE.</span>
                    <h2>
                      Your notebooks{" "}
                      <span className="count-pill">{workspaces.length}</span>
                    </h2>
                  </div>
                  <button
                    className="button small"
                    onClick={() => setModal("create")}
                  >
                    <Plus size={16} /> New notebook
                  </button>
                </div>
                <div className="notebook-controls">
                  <div className="filter-tabs">
                    <button
                      className={filter === "all" ? "selected" : ""}
                      onClick={() => setFilter("all")}
                    >
                      All notebooks
                    </button>
                    <button
                      className={filter === "recent" ? "selected" : ""}
                      onClick={() => setFilter("recent")}
                    >
                      Recently updated
                    </button>
                  </div>
                  <div className="control-right">
                    <label className="search-box">
                      <Search size={16} />
                      <input
                        placeholder="Find a thought..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        aria-label="Search notebooks"
                      />
                      {search && (
                        <button
                          onClick={() => setSearch("")}
                          aria-label="Clear search"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </label>
                    <div className="view-toggle">
                      <button
                        className={layout === "grid" ? "active" : ""}
                        onClick={() => setLayout("grid")}
                        aria-label="Grid view"
                      >
                        <LayoutGrid size={17} />
                      </button>
                      <button
                        className={layout === "list" ? "active" : ""}
                        onClick={() => setLayout("list")}
                        aria-label="List view"
                      >
                        <List size={17} />
                      </button>
                    </div>
                  </div>
                </div>
                <div
                  className={`notebook-grid ${layout === "list" ? "list-layout" : ""}`}
                >
                  {filtered.map((w, i) => (
                    <article
                      key={w.id}
                      className={`notebook-card tone-${i % 3}`}
                    >
                      <button
                        className="card-main"
                        onClick={() => router.push(`/workspace/${w.id}`)}
                      >
                        <div className="card-top">
                          <span className="card-icon">{w.icon || "✳"}</span>
                          <span className="card-number">
                            NO. {String(i + 1).padStart(2, "0")}
                          </span>
                          <ArrowUpRight size={21} />
                        </div>
                        <h3>{w.title}</h3>
                        <p>
                          {w.description ||
                            "A fresh page. A world of possibilities."}
                        </p>
                        <div className="card-meta">
                          <span>
                            <FileText size={13} />
                            {sourceCountFor(w.id)} sources
                          </span>
                          <span>
                            <Clock3 size={13} />
                            {new Date(w.updatedAt).toLocaleDateString("en", {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                      </button>
                      <button
                        className="card-menu"
                        onClick={() => {
                          setEditing(w);
                          setModal("settings");
                        }}
                        aria-label={`Settings for ${w.title}`}
                      >
                        <MoreHorizontal size={20} />
                      </button>
                    </article>
                  ))}
                  <button
                    className="new-notebook-card"
                    onClick={() => setModal("create")}
                  >
                    <span>
                      <Plus size={26} />
                    </span>
                    <h3>Room for one more?</h3>
                    <p>Your next rabbit hole starts here.</p>
                    <strong>
                      Create a notebook <ArrowUpRight size={16} />
                    </strong>
                  </button>
                </div>
                {filtered.length === 0 && (
                  <p className="empty-search">
                    No notebooks match that thought. Try another search.
                  </p>
                )}
              </section>
              <footer className="page-footer">
                <span>
                  <span className="footer-star">✳</span> A messy mind deserves a
                  good notebook.
                </span>
                <span>LESS SCROLLING. MORE DISCOVERING. ↗</span>
              </footer>
            </>
          ) : (
            <>
              <div className="workspace-heading">
                <button
                  className="back-button"
                  onClick={() => router.push("/")}
                  aria-label="Back to notebooks"
                >
                  <ArrowLeft size={19} />
                </button>
                <div>
                  <span className="eyebrow">
                    YOUR NOTEBOOK / {live ? "CONNECTED" : "PREVIEW"}
                  </span>
                  <h1>
                    {workspace?.title ??
                      (sessionPending
                        ? "Opening your notebook..."
                        : "Notebook unavailable")}
                  </h1>
                </div>
                <button
                  className="icon-button"
                  onClick={() => {
                    if (workspace) {
                      setEditing(workspace);
                      setModal("settings");
                    }
                  }}
                  aria-label="Notebook settings"
                >
                  <Settings2 size={19} />
                </button>
              </div>
              {!live && (
                <div className="preview-note">
                  <Sparkles size={15} />
                  <span>
                    You’re exploring a sample notebook. Changes stay in this
                    browser.
                  </span>
                  <button onClick={() => setModal("login")}>
                    Make it yours <ArrowUpRight size={14} />
                  </button>
                </div>
              )}
              {workspace && <>
                <div className="workspace-mode-nav" aria-label="Workspace sections">
                  <button aria-pressed={workspaceMode === "notebook"} className={workspaceMode === "notebook" ? "active" : ""} onClick={() => setWorkspaceMode("notebook")}><BookOpen size={16} /> Notebook</button>
                  <button aria-pressed={workspaceMode === "roadmaps"} className={workspaceMode === "roadmaps" ? "active" : ""} onClick={() => setWorkspaceMode("roadmaps")}><Route size={16} /> Learning roadmaps</button>
                  {workspaceMode === "notebook" && <button className="button small" onClick={() => { setWorkspaceMode("roadmaps"); setRoadmapCreateRequest((value) => value + 1); }}><Plus size={15} /> Generate roadmap</button>}
                </div>
                <div className="workspace-view" hidden={workspaceMode !== "roadmaps"}>
                  <RoadmapPanel key={workspace.id} workspaceId={workspace.id} account={account} sources={wsSources} live={live} active={workspaceMode === "roadmaps"} createRequest={roadmapCreateRequest} />
                </div>
              </>}
              <div className="workspace-view" hidden={workspaceMode !== "notebook"}>
                <div className="mobile-tabs">
                  {["sources", "chat", "studio"].map((tab) => (
                    <button
                      key={tab}
                      className={mobileTab === tab ? "active" : ""}
                      onClick={() => setMobileTab(tab)}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                {workspace ? (
                  <div className={`workspace-panels show-${mobileTab}`}>
                    <section className="sources-panel">
                      <div className="panel-heading">
                        <h2>
                          <FileText size={18} /> Sources{" "}
                          <span>{wsSources.length}</span>
                        </h2>
                        <button
                          className="icon-button"
                          onClick={() => setModal("source")}
                          aria-label="Add source"
                        >
                          <Plus size={18} />
                        </button>
                      </div>
                      <button
                        className="button add-source-button"
                        onClick={() => setModal("source")}
                      >
                        <Plus size={16} /> Add a source
                      </button>
                      <div className="source-caption">YOUR IDEAS START HERE.</div>
                      <label className="select-all">
                        <input
                          type="checkbox"
                          checked={
                            wsSources.length > 0 &&
                            selected.length ===
                            wsSources.filter((s) => s.status === "READY").length
                          }
                          onChange={(e) =>
                            setSelected(
                              e.target.checked
                                ? wsSources
                                  .filter((s) => s.status === "READY")
                                  .map((s) => s.id)
                                : [],
                            )
                          }
                        />{" "}
                        Select all sources <span>{selected.length}</span>
                      </label>
                      <div className="source-list">
                        {wsSources.map((s) => {
                          const Icon =
                            sourceIcons[s.type as keyof typeof sourceIcons] ??
                            FileText;
                          return (
                            <div className="source-row" key={s.id}>
                              <input
                                type="checkbox"
                                aria-label={`Select ${s.title}`}
                                checked={selected.includes(s.id)}
                                disabled={s.status !== "READY"}
                                onChange={(e) =>
                                  setSelected((items) =>
                                    e.target.checked
                                      ? [...items, s.id]
                                      : items.filter((id) => id !== s.id),
                                  )
                                }
                              />
                              <button aria-pressed={viewSource?.id === s.id && rightSection === "source"} onClick={() => { setViewSource(s); setOriginalSourceId(null); setRightSection("source"); setMobileTab("studio"); }}>
                                <span
                                  className={`source-type ${s.type.toLowerCase()}`}
                                >
                                  <Icon size={17} />
                                </span>
                                <span>
                                  <strong>{s.title}</strong>
                                  <small>
                                    {s.type} <span>·</span>{" "}
                                    {s.status === "READY"
                                      ? "Ready to explore"
                                      : s.status.toLowerCase()}
                                  </small>
                                </span>
                                {s.status === "READY" ? (
                                  <CheckCircle2 size={13} />
                                ) : s.status === "FAILED" ? (
                                  <X size={13} />
                                ) : (
                                  <LoaderCircle size={13} className="spin" />
                                )}
                              </button>
                              <button
                                type="button"
                                className="source-delete"
                                aria-label={`Delete ${s.title}`}
                                title="Delete source"
                                disabled={busy}
                                onClick={() => deleteSource(s)}
                              >
                                <X size={15} aria-hidden="true" />
                              </button>
                            </div>
                          );
                        })}
                        {!wsSources.length && (
                          <div className="source-empty">
                            <FileText size={28} />
                            <h3>A blank page is a good start.</h3>
                            <p>Add a PDF, link, video, or your own notes.</p>
                          </div>
                        )}
                      </div>
                      <div className="source-tip">
                        <span className="tip-star">✳</span>
                        <p>
                          Mix your sources.
                          <br />
                          <strong>Find unexpected connections.</strong>
                        </p>
                      </div>
                    </section>
                    <ChatPanel
                      key={`${workspace.id}-${live}`}
                      workspace={workspace}
                      sources={selectedSources}
                      live={live}
                      onError={setError}
                    />
                    <section className="studio-panel">
                      <button className="panel-heading accordion-heading" aria-expanded={rightSection === "studio"} aria-controls="studio-content" onClick={() => setRightSection((section) => section === "studio" ? null : "studio")}>
                        <span><Sparkles size={18} /> Studio</span><ChevronDown size={17} />
                      </button>
                      <div id="studio-content" hidden={rightSection !== "studio"}>
                        <p className="studio-intro">
                          A new way to look at what you know.
                        </p>
                        <div className="studio-tools">
                          {tools.map((tool) => (
                            <button
                              key={tool.type}
                              className={`studio-tool ${tool.color}`}
                              disabled={busy || !selectedSources.length}
                              onClick={() => generate(tool.type)}
                            >
                              <ToolIcon name={tool.icon} />
                              <strong>{tool.label}</strong>
                              <ArrowUpRight size={14} />
                            </button>
                          ))}
                        </div>
                        <div className="studio-divider">
                          <span>YOUR CREATIONS</span>
                          <span>{wsArtifacts.length}</span>
                        </div>
                        <div className="artifact-list">
                          {wsArtifacts.map((a) => (
                            <div key={a.id} className="artifact-row">
                              <button onClick={() => setViewArtifact(a)}>
                                <ToolIcon
                                  name={
                                    tools.find((t) => t.type === a.type)?.icon ??
                                    "file"
                                  }
                                  size={17}
                                />
                                <span>
                                  <strong>{a.title}</strong>
                                  <small>
                                    {a.status === "READY" ? "Ready to open" : a.status === "FAILED" ? "Generation failed · open for details" : a.status === "PENDING" ? "Queued · waiting to start" : "Generating · you can keep working"}
                                  </small>
                                </span>
                                {a.status === "PENDING" || a.status === "PROCESSING" ? <LoaderCircle size={15} className="spin" aria-label="Generation in progress" /> : a.status === "FAILED" ? <X size={15} /> : <ArrowUpRight size={15} />}
                              </button>
                              <button
                                className="artifact-delete"
                                aria-label={`Delete ${a.title}`}
                                onClick={() => {
                                  if (confirm("Delete this study material?"))
                                    run(async () => {
                                      if (live)
                                        await api(
                                          `/workspaces/${workspace.id}/artifacts/${a.id}`,
                                          { method: "DELETE" },
                                        );
                                      setArtifacts((items) =>
                                        items.filter((x) => x.id !== a.id),
                                      );
                                    });
                                }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ))}
                          {!wsArtifacts.length && (
                            <div className="studio-empty">
                              <span>✧</span>
                              <p>
                                Good ideas deserve
                                <br />a second format.
                              </p>
                              <small>Pick a tool above to get started.</small>
                            </div>
                          )}
                        </div>
                        <div className="studio-note">
                          <span>✳</span>
                          <p>Learn it your way.</p>
                          <span>↗</span>
                        </div>
                      </div>
                      <button className="panel-heading accordion-heading" aria-expanded={rightSection === "source"} aria-controls="original-source-content" onClick={() => setRightSection((section) => section === "source" ? null : "source")}>
                        <span><FileText size={18} /> Original source</span><ChevronDown size={17} />
                      </button>
                      <div id="original-source-content" hidden={rightSection !== "source"} className="source-reader">
                        {viewSource ? (<>
                          <div className="artifact-toolbar">
                            <span className="eyebrow">
                              {viewSource.type} / {viewSource.status}
                            </span>
                            <div className="inline-actions">
                              {embeddedUrl ? (
                                <button className="button small" aria-pressed={showingOriginal} onClick={() => setOriginalSourceId(showingOriginal ? null : viewSource.id)}>
                                  {showingOriginal ? "Read text" : "Original"} {viewSource.type === "YOUTUBE" ? <Play size={14} /> : <Link2 size={14} />}
                                </button>
                              ) : (viewSource.url || viewSource.metadata?.fileUrl) ? (
                                <a
                                  className="button small"
                                  href={viewSource.url || String(viewSource.metadata?.fileUrl || "")}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Original <ExternalLink size={14} />
                                </a>
                              ) : null}
                              {viewSource.status === "FAILED" && live && (
                                <button
                                  className="button small"
                                  onClick={() =>
                                    run(async () => {
                                      await api(
                                        `/workspaces/${workspace!.id}/sources/${viewSource.id}/retry`,
                                        { method: "POST" },
                                      );
                                      notify("Retry queued.");
                                      setViewSource(null);
                                    })
                                  }
                                >
                                  <RefreshCw size={14} /> Retry
                                </button>
                              )}
                              <button
                                className="button danger small"
                                disabled={busy}
                                onClick={() => deleteSource(viewSource)}
                              >
                                <Trash2 size={14} /> Delete
                              </button>
                            </div>
                          </div>
                          <h3 className="source-reader-title">{viewSource.title}</h3>
                          {/* {viewSource.type === "PDF" && typeof viewSource.metadata?.fileUrl === "string" && (
            <iframe className="source-original-frame" title={`Original PDF: ${viewSource.title}`} src={viewSource.metadata.fileUrl} />
          )} */}
                          {showingOriginal ? (
                            <div className="embedded-source">
                              <p className="embed-help">{viewSource.type === "YOUTUBE" ? "If the video is unavailable here, you can still read its transcript." : "Some websites don’t allow viewing inside another app. You can still read the extracted text."}</p>
                              <iframe
                                key={`${viewSource.id}:${embeddedUrl}`}
                                className={`source-original-frame ${viewSource.type === "YOUTUBE" ? "source-video-frame" : ""}`}
                                title={`Original ${viewSource.type === "YOUTUBE" ? "video" : "website"}: ${viewSource.title}`}
                                src={embeddedUrl!}
                                sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                                allowFullScreen
                                referrerPolicy="strict-origin-when-cross-origin"
                              />
                              <button className="button small" onClick={() => setOriginalSourceId(null)}>{viewSource.type === "YOUTUBE" ? "Read transcript" : "Read extracted text"}</button>
                            </div>
                          ) : <pre className="source-content">
                            {viewSource.content ?? "Content will appear after processing."}
                          </pre>}

                        </>) : <p className="studio-intro">Choose a source on the left to read it here.</p>}
                      </div>
                    </section>
                  </div>
                ) : (
                  <div className="empty-state">
                    <h2>
                      {notebooksQuery.isPending && live
                        ? "Opening your notebook..."
                        : "This notebook isn’t here."}
                    </h2>
                    <p>
                      Sign in to load your notebooks, or head back to your space.
                    </p>
                    <button className="button" onClick={() => router.push("/")}>
                      Back to notebooks
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
      {(error || (queryError && queryError.message !== dismissedQueryError)) && (
        <div role="alert" className="error-toast">
          <span>{error || queryError?.message}</span>
          <button aria-label="Dismiss error" onClick={() => {
            setError("");
            setDismissedQueryError(queryError?.message ?? "");
          }}>
            <X size={17} />
          </button>
        </div>
      )}
      {toast && (
        <div role="status" className="toast">
          <Check size={18} />
          {toast}
        </div>
      )}
      {(modal === "create" || modal === "settings") && (
        <WorkspaceForm
          editing={editing}
          busy={busy}
          onClose={closeModal}
          onSubmit={saveWorkspace}
          onDelete={deleteWorkspace}
        />
      )}
      {modal === "source" && (
        <SourceForm
          busy={busy}
          onClose={closeModal}
          onSubmit={addSource}
          live={live}
        />
      )}
      {activeArtifact && (
        <ArtifactViewer
          key={activeArtifact.id}
          artifact={activeArtifact}
          onClose={() => setViewArtifact(null)}
        />
      )}
      {modal === "login" && (
        <Modal title="A home for your curious mind." onClose={closeModal}>
          <div className="login-content">
            <span className="login-star">✳</span>
            <h3>Your ideas. All in one place.</h3>
            <p>
              Sign in to save notebooks, upload sources, and explore with AI.
            </p>
            <button
              className="button primary"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const result = await authClient.signIn.social({
                    provider: "google",
                    callbackURL: standaloneRoadmaps ? `${window.location.origin}/roadmaps` : window.location.origin,
                  });
                  if (result.error)
                    throw new Error(
                      result.error.message || "Could not sign in.",
                    );
                })
              }
            >
              <span className="google-g">G</span> Continue with Google{" "}
              <ArrowUpRight size={18} />
            </button>
            <button className="text-button" onClick={closeModal}>
              Keep exploring the preview
            </button>
            <small>Your private workspace, at your own pace.</small>
          </div>
        </Modal>
      )}
      {modal === "roadmaps" && (
        <Modal title={roadmapPickerAction === "create" ? "Choose a notebook for your new roadmap." : "Choose a notebook for your roadmaps."} onClose={closeModal}>
          <p className="muted">{roadmapPickerAction === "create" ? "Choose your notebook, then select sources and a learning duration." : "Each notebook has its own learning paths and saved progress."}</p>
          {/* {workspaces.length > 0 && (roadmapPickerAction === "browse" ? <button className="button primary" onClick={() => setRoadmapPickerAction("create")}><Plus size={16} /> Create new roadmap</button> : <button className="text-button" onClick={() => setRoadmapPickerAction("browse")}><ArrowLeft size={15} /> View saved roadmaps instead</button>)} */}
          <div className="sidebar-notebooks">
            {workspaces.map((item) => (
              <button className="notebook-link" key={item.id} onClick={() => {
                const create = roadmapPickerAction === "create";
                closeModal();
                router.push(`/workspace/${item.id}?view=roadmaps${create ? "&create=roadmap" : ""}`);
              }}>
                <Route size={18} /><span>{item.title}</span><ArrowUpRight size={16} />
              </button>
            ))}
          </div>
          {!workspaces.length && <>
            <p>Create a notebook and add sources to start building your learning path.</p>
            <button className="button primary" onClick={() => { setEditing(null); setModal("create"); }}><Plus size={16} /> Create a notebook</button>
          </>}
        </Modal>
      )}
      {modal === "memory" && (
        <MemoryPanel
          memories={memories}
          setMemories={setMemories}
          live={live}
          busy={busy}
          run={run}
          notify={notify}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
