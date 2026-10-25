"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, BarChart3, Check, ChevronDown, Clock3, ExternalLink, FileText, Flame, LoaderCircle, Map, Pencil, Plus, RefreshCw, Route, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import type { Source } from "@/lib/notebook";
import { durationChoices, phaseLabel, taskProgress, toggleRoadmapTask, type LearningRoadmap, type RoadmapAnalytics, type RoadmapDuration } from "@/lib/roadmap";
import { Modal } from "./primitives";
import { RoadmapResourceViewer } from "./roadmap-resource-viewer";

export function RoadmapPanel({ workspaceId, account, sources, live, active, createRequest, initialRoadmapId, initialResource, apiBase, onCreate }: { workspaceId: string; account: string; sources: Source[]; live: boolean; active: boolean; createRequest: number; initialRoadmapId?: string; initialResource?: { id: string; taskId: string }; apiBase?: string; onCreate?: () => void }) {
  const client = useQueryClient();
  const base = apiBase ?? `/workspaces/${workspaceId}/roadmaps`;
  const listKey = ["roadmaps", account, workspaceId];
  const [activeId, setActiveId] = useState<string | null>(initialRoadmapId ?? null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [resource, setResource] = useState<{ id: string; taskId: string } | null>(initialResource ?? null);
  const [mobileView, setMobileView] = useState<"roadmap" | "resource">("roadmap");
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [splitPercent, setSplitPercent] = useState(52);
  const lastCreate = useRef(0);
  const opened = useRef<string | null>(null);
  const detailKey = ["roadmap", account, workspaceId, activeId];
  const analyticsKey = ["roadmap-analytics", account, workspaceId, activeId];
  const list = useQuery({ queryKey: listKey, queryFn: () => api<LearningRoadmap[]>(base), enabled: live && active, refetchInterval: (query) => query.state.data?.some((item) => item.status === "generating") ? 3000 : false });
  const detail = useQuery({ queryKey: detailKey, queryFn: () => api<LearningRoadmap>(`${base}/${activeId}`), enabled: live && active && !!activeId, refetchInterval: (query) => query.state.data?.status === "generating" ? 3000 : false });
  const roadmap = detail.data;
  const analytics = useQuery({ queryKey: analyticsKey, queryFn: () => api<RoadmapAnalytics>(`${base}/${activeId}/analytics`), enabled: live && active && !!activeId && showAnalytics && roadmap?.status === "ready" });
  useEffect(() => {
    if (active && createRequest > lastCreate.current) { lastCreate.current = createRequest; setCreating(true); }
  }, [active, createRequest]);
  useEffect(() => {
    if (roadmap?.status === "ready" && opened.current !== roadmap.id) {
      opened.current = roadmap.id;
      const current = roadmap.weeks.find((week) => week.weekNumber === roadmap.progress.currentWeek) ?? roadmap.weeks[0];
      setExpanded(new Set(current ? [current.id] : []));
    }
  }, [roadmap]);
  const invalidate = () => {
    void client.invalidateQueries({ queryKey: listKey });
    void client.invalidateQueries({ queryKey: detailKey });
    void client.invalidateQueries({ queryKey: analyticsKey });
  };
  const taskMutation = useMutation({
    mutationFn: ({ taskId, isCompleted }: { taskId: string; isCompleted: boolean }) => api<LearningRoadmap>(`${base}/${activeId}/tasks/${encodeURIComponent(taskId)}`, { method: "PATCH", body: JSON.stringify({ isCompleted }) }),
    onMutate: async ({ taskId, isCompleted }) => {
      setError("");
      await client.cancelQueries({ queryKey: detailKey });
      const previous = client.getQueryData<LearningRoadmap>(detailKey);
      if (previous) client.setQueryData(detailKey, toggleRoadmapTask(previous, taskId, isCompleted));
      return { previous, key: detailKey };
    },
    onError: (_error, _variables, context) => { if (context?.previous) client.setQueryData(context.key, context.previous); setError("Your progress couldn’t be saved. The checkbox has been restored. Please try again."); },
    onSuccess: (value, _variables, context) => client.setQueryData(context?.key ?? detailKey, value),
    onSettled: (_value, _error, _variables, context) => {
      void client.invalidateQueries({ queryKey: context?.key ?? detailKey });
      void client.invalidateQueries({ queryKey: listKey });
      void client.invalidateQueries({ queryKey: ["roadmap-analytics", account, workspaceId] });
    },
  });
  const manage = useMutation({ mutationFn: async ({ method, path, body }: { method: string; path: string; body?: unknown }) => api<LearningRoadmap | undefined>(path, { method, ...(body ? { body: JSON.stringify(body) } : {}) }), onError: (error) => setError(error.message), onSuccess: invalidate });
  function beginCreation() { if (onCreate) onCreate(); else setCreating(true); }
  function openRoadmap(id: string) { setActiveId(id); setResource(null); setMobileView("roadmap"); setShowAnalytics(false); setError(""); setNotice(""); }
  async function openResource(id: string, taskId: string) {
    setResource({ id, taskId }); setMobileView("resource");
    try { await api(`${base}/${activeId}/resources/${encodeURIComponent(id)}/open`, { method: "POST" }); void client.invalidateQueries({ queryKey: analyticsKey }); }
    catch { setError("The resource opened, but its activity could not be recorded."); }
  }
  async function rename() {
    if (!roadmap) return;
    const title = prompt("Rename this roadmap", roadmap.title)?.trim();
    if (!title || title === roadmap.title) return;
    const result = await manage.mutateAsync({ method: "PATCH", path: `${base}/${roadmap.id}`, body: { title } }).catch(() => undefined);
    if (result) client.setQueryData(detailKey, result);
  }
  async function remove(target: LearningRoadmap | undefined = roadmap) {
    if (!target || manage.isPending || !confirm(`Delete “${target.title}”? Its saved progress and learning activity will also be removed.`)) return;
    setError("");
    try {
      await manage.mutateAsync({ method: "DELETE", path: `${base}/${target.id}` });
      client.setQueryData<LearningRoadmap[]>(listKey, (items) => items?.filter((item) => item.id !== target.id));
      if (activeId === target.id) { setActiveId(null); setResource(null); }
      client.removeQueries({ queryKey: ["roadmap", account, workspaceId, target.id], exact: true });
      client.removeQueries({ queryKey: ["roadmap-analytics", account, workspaceId, target.id], exact: true });
      client.removeQueries({ queryKey: ["roadmap-resource", account, `${base}/${target.id}`] });
      setNotice("Roadmap deleted.");
    } catch { /* Keep the roadmap visible; the mutation shows the error. */ }
  }
  if (!live) return <section className="roadmap-signin"><span className="roadmap-mark"><Route size={30} /></span><h2>Your sources. Your learning path.</h2><p>Sign in to generate roadmaps from real sources and save your learning progress across visits.</p><p className="muted">Roadmaps aren’t generated in preview mode.</p></section>;
  return (
    <section className="roadmap-workspace" aria-label="Learning roadmap">
      {(error || detail.error || list.error) && <div className="roadmap-error" role="alert"><span>{error || detail.error?.message || list.error?.message}</span><button className="text-button" onClick={() => { setError(""); void detail.refetch(); void list.refetch(); }}>Try again</button></div>}
      {notice && <p className="roadmap-notice" role="status">{notice}</p>}
      {!activeId ? <>
        <header className="roadmap-home-header"><div><span className="eyebrow">A PATH THROUGH YOUR POSSIBILITIES</span><h2>Learning roadmaps<span>.</span></h2><p>Turn what you’ve collected into what you can do.</p></div><button className="button primary" onClick={beginCreation}><Plus size={17} /> Generate roadmap</button></header>
        {list.isPending ? <RoadmapLoading label="Loading your roadmaps" /> : list.isError ? null : !list.data?.length ? <div className="roadmap-empty"><Route size={42} /><h3>A starting point. A way forward.</h3><p>Choose your sources and a pace. Zehniq will map out concepts, practice, and milestones grounded in your materials.</p></div> : <div className="roadmap-history">{list.data.map((item) => <article className={`roadmap-history-card status-${item.status}`} key={item.id}><button className="roadmap-card-open" onClick={() => openRoadmap(item.id)}><span className="roadmap-card-top"><Route size={24} /><span className="tiny-tag">{item.durationMonths} {item.durationMonths === 1 ? "MONTH" : "MONTHS"} · {item.durationMonths * 4} WEEKS</span><ArrowRight size={18} /></span><h3>{item.title}</h3>{item.status === "ready" ? <><ProgressBar percent={item.progress.percent} label={`${item.title}: ${item.progress.percent}% complete`} /><p>{item.progress.completedTasks} / {item.progress.totalTasks} tasks · <strong>{item.progress.percent}%</strong></p></> : <p className="roadmap-card-status">{item.status === "generating" ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />}{item.status === "generating" ? phaseLabel(item.phase) : "Generation paused · open to retry"}</p>}<small>Created {new Date(item.createdAt).toLocaleDateString()}</small></button><div className="roadmap-history-actions"><button className="button danger small" aria-label={`Delete roadmap ${item.title}`} disabled={manage.isPending} onClick={() => remove(item)}><Trash2 size={14} />Delete</button></div></article>)}</div>}
      </> : <>
        <div className="roadmap-detail-toolbar"><button className="text-button" onClick={() => { setActiveId(null); setResource(null); }}><ArrowLeft size={15} /> All roadmaps</button><div><button className="button small" disabled={!roadmap || manage.isPending} onClick={rename}><Pencil size={14} /> Rename</button><button className="button small" disabled={!roadmap || roadmap.status === "generating"} onClick={beginCreation}><Plus size={14} /> New version</button><button className="icon-button" aria-label="Delete roadmap" disabled={!roadmap || manage.isPending || taskMutation.isPending} onClick={() => remove()}><Trash2 size={17} /></button></div></div>
        {detail.isPending ? <RoadmapLoading label="Opening your learning path" /> : roadmap?.status === "generating" ? <GenerationState phase={roadmap.phase} /> : roadmap?.status === "failed" ? <div className="roadmap-empty" role="status"><RefreshCw size={36} /><h3>This path needs another try.</h3><p>{roadmap.generationError || "We couldn’t finish building your roadmap. Your sources and other roadmaps are safe."}</p><button className="button primary" disabled={manage.isPending} onClick={async () => { const result = await manage.mutateAsync({ method: "POST", path: `${base}/${roadmap.id}/retry` }).catch(() => undefined); if (result) client.setQueryData(detailKey, result); }}>{manage.isPending ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />} Retry generation</button></div> : roadmap ? <>
          <header className="roadmap-title-header"><span className="eyebrow">YOUR ROAD TO UNDERSTANDING</span><h2>{roadmap.title}</h2><div className="roadmap-title-meta"><span>{roadmap.durationMonths} {roadmap.durationMonths === 1 ? "month" : "months"} · {roadmap.weeks.length} weeks</span><span>{roadmap.sourceIds.length} source{roadmap.sourceIds.length === 1 ? "" : "s"}</span><span>{roadmap.progress.currentWeek ? `Next up: Week ${roadmap.progress.currentWeek}` : roadmap.progress.totalTasks ? "All milestones complete" : "No tasks yet"}</span></div><div className="roadmap-progress-summary"><strong>{roadmap.progress.percent}%</strong><span>{roadmap.progress.completedTasks} of {roadmap.progress.totalTasks} tasks completed</span><button className={`button small ${showAnalytics ? "active" : ""}`} aria-expanded={showAnalytics} onClick={() => setShowAnalytics((value) => !value)}><BarChart3 size={16} /> Learning analytics</button></div><ProgressBar percent={roadmap.progress.percent} label="Overall roadmap completion" /></header>
          {!!roadmap.limitations.length && <details className="roadmap-limitations"><summary>Research & source notes ({roadmap.limitations.length})</summary><ul>{roadmap.limitations.map((limitation, index) => <li key={index}>{limitation}</li>)}</ul></details>}
          {showAnalytics && <div className="roadmap-analytics-section" aria-label="Learning analytics">{analytics.isPending ? <RoadmapLoading label="Loading saved learning activity" /> : analytics.isError ? <div className="roadmap-error" role="alert">Analytics couldn’t be loaded. <button className="text-button" onClick={() => analytics.refetch()}>Try again</button></div> : analytics.data ? <Analytics data={analytics.data} /> : null}</div>}
          {resource && <div className="roadmap-split-options"><label className="roadmap-resize-control">Roadmap width <input type="range" min={35} max={65} value={splitPercent} onChange={(event) => setSplitPercent(Number(event.target.value))} aria-label="Resize roadmap panel" /></label><div className="roadmap-mobile-tabs" aria-label="Learning workspace view"><button aria-pressed={mobileView === "roadmap"} className={mobileView === "roadmap" ? "active" : ""} onClick={() => setMobileView("roadmap")}>Roadmap</button><button aria-pressed={mobileView === "resource"} className={mobileView === "resource" ? "active" : ""} onClick={() => setMobileView("resource")}>Resource</button></div></div>}
          <div className={`roadmap-learning-layout ${resource ? "is-split" : ""} show-${mobileView}`} style={{ "--roadmap-width": `${splitPercent}%` } as CSSProperties}>
            <div className="roadmap-path-scroll">
              {!roadmap.weeks.length || !roadmap.progress.totalTasks ? <div className="roadmap-empty"><Map size={34} /><h3>No tasks in this roadmap.</h3><p>Create a new version to build an actionable learning path.</p></div> : <div className="roadmap-timeline">{roadmap.weeks.map((week) => {
                const progress = taskProgress(week.tasks); const isOpen = expanded.has(week.id); const isCurrent = roadmap.progress.currentWeek === week.weekNumber;
                return <article className={`roadmap-week ${progress.totalTasks && progress.percent === 100 ? "complete" : ""} ${isCurrent ? "current" : ""}`} key={week.id}>
                  <span className="roadmap-mile-marker" aria-hidden="true">{progress.totalTasks && progress.percent === 100 ? <Check size={18} /> : week.weekNumber}</span>
                  <button className="roadmap-week-heading" aria-expanded={isOpen} aria-controls={`roadmap-week-${week.id}`} onClick={() => setExpanded((items) => { const next = new Set(items); if (next.has(week.id)) next.delete(week.id); else next.add(week.id); return next; })}><span><span className="eyebrow">WEEK {String(week.weekNumber).padStart(2, "0")}{isCurrent ? " · NEXT MILESTONE" : ""}</span><h3>{week.title}</h3><span className="roadmap-week-count">{progress.completedTasks}/{progress.totalTasks} tasks · {progress.percent}%</span></span><ChevronDown size={19} className={isOpen ? "expanded" : ""} /></button>
                  <div id={`roadmap-week-${week.id}`} hidden={!isOpen} className="roadmap-week-content"><p className="roadmap-week-objective">{week.objective}</p>{week.topics.length > 0 && <div className="roadmap-topics">{week.topics.map((topic) => <span key={topic}>{topic}</span>)}</div>}<div className="roadmap-task-list">{week.tasks.map((task) => <div key={task.id} className={`roadmap-task ${task.isCompleted ? "completed" : ""} ${resource?.taskId === task.id ? "active-resource" : ""}`}><label className="roadmap-task-label"><input type="checkbox" checked={task.isCompleted} disabled={taskMutation.isPending} onChange={(event) => taskMutation.mutate({ taskId: task.id, isCompleted: event.target.checked })} aria-label={`${task.isCompleted ? "Mark incomplete" : "Complete task"}: ${task.title}`} /><span><strong>{task.title}</strong>{task.description && <span className="roadmap-task-description">{task.description}</span>}<span className="roadmap-task-effort">{task.kind === "practice" ? "BUILD & PRACTICE" : task.kind === "revision" ? "REVISIT & REFLECT" : "READ & UNDERSTAND"}{task.estimatedMinutes ? ` · ~${task.estimatedMinutes} min` : ""}{taskMutation.isPending && taskMutation.variables.taskId === task.id ? " · Saving…" : ""}</span></span></label>{task.resourceIds.length > 0 && <div className="roadmap-task-resources">{task.resourceIds.map((resourceId) => { const item = roadmap.resources.find((entry) => entry.id === resourceId); return item ? <button key={item.id} className={`roadmap-resource-link ${resource?.id === item.id && resource.taskId === task.id ? "active" : ""}`} aria-label={`Open resource ${item.title}`} onClick={() => openResource(item.id, task.id)}><FileText size={14} /><span>{item.title}<small>{item.type.toUpperCase()} · {item.origin === "uploaded" ? "YOUR SOURCE" : "WEB RESEARCH"}</small></span><ExternalLink size={13} /></button> : null; })}</div>}</div>)}</div>{week.expectedOutcome && <p className="roadmap-week-outcome"><Check size={16} /><span><strong>By the end of this week</strong>{week.expectedOutcome}</span></p>}</div>
                </article>;
              })}</div>}
            </div>
            {resource && <RoadmapResourceViewer key={resource.id} base={`${base}/${roadmap.id}`} resourceId={resource.id} account={account} onClose={() => { setResource(null); setMobileView("roadmap"); }} />}
          </div>
          <footer className="roadmap-progress-footer"><span><Check size={15} /> {roadmap.progress.completedTasks} / {roadmap.progress.totalTasks} tasks complete</span><strong>{roadmap.progress.percent}% of your path</strong><span>Opening a resource doesn’t mark it complete.</span></footer>
        </> : null}
      </>}
      {creating && <RoadmapCreation key={createRequest} sources={sources} base={base} onClose={() => setCreating(false)} onCreated={(value) => { client.setQueryData(["roadmap", account, workspaceId, value.id], value); setCreating(false); openRoadmap(value.id); void client.invalidateQueries({ queryKey: listKey }); setNotice("Your roadmap is being built. You can keep learning while it generates."); }} />}
    </section>
  );
}

function RoadmapCreation({ sources, base, onClose, onCreated }: { sources: Source[]; base: string; onClose: () => void; onCreated: (roadmap: LearningRoadmap) => void }) {
  const eligible = sources.filter((source) => source.status === "READY");
  const [selected, setSelected] = useState<string[]>(eligible.map((source) => source.id));
  const previousReady = useRef(new Set(eligible.map((source) => source.id)));
  useEffect(() => {
    const readyIds = sources.filter((source) => source.status === "READY").map((source) => source.id);
    const ready = new Set(readyIds);
    const previous = previousReady.current;
    setSelected((items) => [...items.filter((id) => ready.has(id)), ...readyIds.filter((id) => !previous.has(id))]);
    previousReady.current = ready;
  }, [sources]);
  const [duration, setDuration] = useState<RoadmapDuration | null>(null);
  const create = useMutation({ mutationFn: () => api<LearningRoadmap>(base, { method: "POST", body: JSON.stringify({ durationMonths: duration, sourceIds: selected.filter((id) => eligible.some((source) => source.id === id)) }) }), onSuccess: onCreated });
  return <Modal title="A roadmap that starts with your sources." onClose={onClose} wide><form className="roadmap-creation" onSubmit={(event) => { event.preventDefault(); if (duration && selected.length && !create.isPending) create.mutate(); }}><p className="muted">Choose what you want to learn from, then choose your pace. We’ll build the path around your materials.</p><fieldset disabled={create.isPending}><legend>01 · Your foundation</legend>{!eligible.length ? <p className="roadmap-error">Add and finish processing at least one source before creating a roadmap.</p> : <><label className="roadmap-select-all"><input type="checkbox" checked={eligible.length > 0 && eligible.every((source) => selected.includes(source.id))} onChange={(event) => setSelected(event.target.checked ? eligible.map((source) => source.id) : [])} />Select all ready sources <span>{selected.length} selected</span></label><div className="roadmap-source-picker">{eligible.map((source) => <label key={source.id}><input type="checkbox" checked={selected.includes(source.id)} onChange={(event) => setSelected((items) => event.target.checked ? [...items, source.id] : items.filter((id) => id !== source.id))} /><FileText size={17} /><span><strong>{source.title}</strong><small>{source.type}</small></span></label>)}</div></>}</fieldset><fieldset disabled={create.isPending}><legend>02 · Your learning pace</legend><div className="roadmap-duration-picker">{durationChoices.map((choice) => <label className={duration === choice.months ? "selected" : ""} key={choice.months}><input type="radio" name="roadmap-duration" value={choice.months} checked={duration === choice.months} required onChange={() => setDuration(choice.months)} /><span className="eyebrow">{choice.pace}</span><strong>{choice.months} {choice.months === 1 ? "Month" : "Months"}</strong><span>{choice.weeks} weekly milestones</span><p>{choice.description}</p></label>)}</div></fieldset><p className="roadmap-reader-note">Uploaded sources form the foundation. Web research may add resources for missing topics. Existing roadmaps and progress won’t be overwritten.</p>{create.isError && <p className="roadmap-error" role="alert">{create.error.message}</p>}<div className="roadmap-create-actions"><button type="button" className="button" disabled={create.isPending} onClick={onClose}>Cancel</button><button className="button primary" disabled={!duration || !selected.length || !eligible.length || create.isPending}>{create.isPending ? <LoaderCircle className="spin" size={17} /> : <Route size={17} />}{create.isPending ? "Starting your roadmap…" : "Generate my roadmap"}</button></div></form></Modal>;
}

function ProgressBar({ percent, label }: { percent: number; label: string }) { return <div className="roadmap-progress-bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} /></div>; }
function RoadmapLoading({ label }: { label: string }) { return <div className="roadmap-loading" role="status"><LoaderCircle className="spin" size={25} /><p>{label}…</p></div>; }
export function GenerationState({ phase }: { phase: string }) { return <div className="roadmap-generating" aria-busy="true"><span className="roadmap-mark"><Route size={30} /></span><span className="eyebrow">A PATH BUILT FROM YOUR SOURCES</span><h2>Your learning journey is taking shape.</h2><p role="status"><LoaderCircle className="spin" size={18} />{phaseLabel(phase)}</p><div className="roadmap-generation-skeleton" aria-hidden="true">{[1, 2, 3].map((item) => <div key={item}><span /><i /><i /></div>)}</div><p className="muted">You can return to your notebook. This roadmap is saved here and updates automatically.</p></div>; }

export function Analytics({ data }: { data: RoadmapAnalytics }) {
  const max = Math.max(1, ...data.dailyActivity.map((day) => day.completedTasks));
  return <><div className="roadmap-analytics-heading"><h3><BarChart3 size={18} /> Your learning, in motion.</h3><span>Based on saved activity · {data.timezone || "UTC"} days</span></div><div className="roadmap-analytics-stats"><div><Flame size={19} /><strong>{data.streakDays}</strong><span>day activity streak</span></div><div><Check size={19} /><strong>{data.completedWeeks}/{data.totalWeeks}</strong><span>weeks complete</span></div><div><FileText size={19} /><strong>{data.resourceOpens}</strong><span>resource opens</span></div><div><Clock3 size={19} /><strong>{data.estimatedMinutesCompleted}</strong><span>estimated task minutes completed</span></div></div><div className="roadmap-analytics-charts"><section><h4>Tasks completed · last 14 days</h4><div className="roadmap-activity-chart" role="img" aria-label={`Tasks completed per day over the last fourteen UTC days: ${data.dailyActivity.map((day) => `${day.date}: ${day.completedTasks}`).join(", ")}`}>{data.dailyActivity.map((day) => <div key={day.date} title={`${day.date}: ${day.completedTasks} task completions, ${day.resourceOpens} resource opens`}><span style={{ height: `${day.completedTasks ? Math.max(8, day.completedTasks / max * 100) : 3}%` }} className={day.completedTasks ? "has-activity" : ""} /><small>{day.date.slice(8)}</small></div>)}</div><p>{data.activeDays} active days across your roadmap. Reopening a task keeps your progress accurate; activity counts show recorded actions.</p></section><section><h4>Milestone completion</h4><div className="roadmap-week-bars">{data.weeklyProgress.map((week) => <div key={week.weekNumber}><span>Week {week.weekNumber}</span><ProgressBar percent={week.percent} label={`Week ${week.weekNumber} completion`} /><strong>{week.completedTasks}/{week.totalTasks}</strong></div>)}</div></section></div><p className="roadmap-reader-note">Effort comes from optional task estimates, not a study timer or a measurement of mastery. A streak means activity on consecutive days.</p></>;
}
