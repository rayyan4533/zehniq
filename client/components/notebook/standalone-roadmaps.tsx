"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CheckCircle2, FileText, LoaderCircle, Pencil, Plus, Route, Sparkles, Trash2, X } from "lucide-react";
import { api } from "@/lib/api";
import type { Source } from "@/lib/notebook";
import { durationChoices, type LearningRoadmap, type RoadmapDuration } from "@/lib/roadmap";
import { parseTopicGoals, type RoadmapCollection } from "@/lib/standalone-roadmap";
import { SourceForm } from "./forms";
import { RoadmapPanel } from "./roadmap-panel";

const emptySources: Source[] = [];

export function StandaloneRoadmaps({ account, live, onSignIn }: { account: string; live: boolean; onSignIn: () => void }) {
  const router = useRouter();
  const params = useSearchParams();
  const client = useQueryClient();
  const id = params.get("collection");
  const building = params.get("build") === "1";
  const base = `/roadmaps/collections${id ? `/${encodeURIComponent(id)}` : ""}`;
  const [error, setError] = useState("");
  const [renameTitle, setRenameTitle] = useState<string | null>(null);
  const [lastPlan, setLastPlan] = useState<{ collectionId: string; id: string } | null>(null);
  const listKey = ["standalone-collections", account];
  const collectionKey = ["standalone-collection", account, id];
  const list = useQuery({ queryKey: listKey, queryFn: () => api<RoadmapCollection[]>("/roadmaps/collections"), enabled: live && !id, staleTime: 0, refetchInterval: (query) => query.state.data?.some((item) => item.roadmaps?.some((roadmap) => roadmap.status === "generating")) ? 3000 : false });
  const collection = useQuery({ queryKey: collectionKey, queryFn: () => api<RoadmapCollection>(base), enabled: live && !!id, refetchInterval: (query) => query.state.data?.sources?.some((source) => source.status === "PENDING" || source.status === "PROCESSING") ? 3000 : false });
  const create = useMutation({ mutationFn: () => api<RoadmapCollection>("/roadmaps/collections", { method: "POST", body: JSON.stringify({}) }), onSuccess: (value) => { setError(""); void client.invalidateQueries({ queryKey: listKey }); router.push(`/roadmaps?collection=${value.id}&build=1`); }, onError: () => setError("We couldn’t start a new learning path. Please try again.") });
  const remove = useMutation({ mutationFn: (collectionId: string) => api(`/roadmaps/collections/${collectionId}`, { method: "DELETE" }), onSuccess: (_value, deletedId) => { client.setQueryData<RoadmapCollection[]>(listKey, (items) => items?.filter((item) => item.id !== deletedId)); client.removeQueries({ queryKey: ["standalone-collection", account, deletedId] }); void client.invalidateQueries({ queryKey: listKey }); }, onError: (failure) => setError(failure.message) });
  const rename = useMutation({
    mutationFn: ({ collectionId, title }: { collectionId: string; title: string }) => api<RoadmapCollection>(`/roadmaps/collections/${encodeURIComponent(collectionId)}`, { method: "PATCH", body: JSON.stringify({ title }) }),
    onSuccess: (value, { collectionId }) => {
      const key = ["standalone-collection", account, collectionId];
      client.setQueryData<RoadmapCollection>(key, (current) => current ? { ...current, title: value.title, updatedAt: value.updatedAt } : current);
      client.setQueryData<RoadmapCollection[]>(listKey, (items) => items?.map((item) => item.id === collectionId ? { ...item, title: value.title, updatedAt: value.updatedAt } : item));
      setRenameTitle(null); setError("");
      void client.invalidateQueries({ queryKey: key }); void client.invalidateQueries({ queryKey: listKey });
    },
    onError: (failure) => setError(failure.message),
  });
  if (!live) return <section className="standalone-welcome"><span className="roadmap-mark"><Route size={32} /></span><span className="eyebrow">YOUR OWN ROAD TO UNDERSTANDING</span><h1>Build your path<span>.</span></h1><p>Bring sources, add the topics you want to learn, and turn them into a practical learning roadmap. No notebook required.</p><button className="button primary" onClick={onSignIn}>Sign in to create a roadmap <ArrowRight size={17} /></button></section>;
  return <section className="standalone-roadmaps">
    {!id && <header className="standalone-header"><div><span className="eyebrow">LEARN IT. UNDERSTAND IT. OWN IT.</span><h1>Roadmap Builder<span>.</span></h1><p>Start with your curiosity. Your sources and goals live here independently of notebooks.</p></div><button className="button primary" disabled={create.isPending} onClick={() => create.mutate()}>{create.isPending ? <LoaderCircle className="spin" size={17} /> : <Plus size={17} />} Create roadmap</button></header>}
    {error && <p className="roadmap-error" role="alert">{error}<button className="text-button" onClick={() => setError("")}>Dismiss</button></p>}
    {!id ? list.isPending ? <p className="standalone-loading" role="status"><LoaderCircle className="spin" size={20} /> Opening your learning paths…</p> : list.isError ? <div className="roadmap-error" role="alert">We couldn’t load your learning paths. <button className="text-button" onClick={() => list.refetch()}>Try again</button></div> : !list.data?.length ? <div className="standalone-empty"><Sparkles size={36} /><h2>A topic. A few sources. A way forward.</h2><p>Create a roadmap to add PDFs, links, videos, or notes. Add extra topics—or start with topics alone and let web research find your study resources.</p></div> : <div className="standalone-path-list">{list.data.map((item) => {
      const latest = item.roadmaps?.[0];
      const title = item.title === "New learning path" ? latest?.title ?? item.title : item.title;
      return <article className="standalone-path-card" key={item.id}><button className="standalone-path-open" onClick={() => { setError(""); setRenameTitle(null); router.push(`/roadmaps?collection=${item.id}${item.roadmaps?.length ? "" : "&build=1"}`); }}><span className="standalone-path-icon"><Route size={22} /></span><h2>{title}</h2><p>{item.sourceCount ?? 0} sources · {item.roadmaps?.length ?? 0} saved roadmaps</p><small>{latest?.status === "generating" ? "Generation in progress" : latest?.status === "failed" ? "Open to retry generation" : latest ? `${latest.progress.percent}% complete · continue learning` : "Draft · add your sources and topics"}</small><ArrowRight size={18} /></button><button className="icon-button" disabled={remove.isPending} aria-label={`Delete learning path ${title}`} onClick={() => { if (confirm("Delete this learning path, its sources, roadmaps, progress, and activity? Your notebooks won’t be affected.")) remove.mutate(item.id); }}><Trash2 size={17} /></button></article>;
    })}</div> : <>
      <div className="standalone-navigation"><button className="text-button" onClick={() => { setError(""); setRenameTitle(null); router.push("/roadmaps"); }}><ArrowLeft size={16} aria-hidden="true" /> All learning paths</button><div><button className={`button small ${building ? "active" : ""}`} onClick={() => router.push(`/roadmaps?collection=${id}&build=1`)}><FileText size={15} /> Sources & topics</button><button className={`button small ${!building ? "active" : ""}`} onClick={() => router.push(`/roadmaps?collection=${id}`)}><Route size={15} /> Saved roadmaps</button></div></div>
      {collection.isPending ? <p className="standalone-loading" role="status"><LoaderCircle className="spin" size={20} /> Opening this learning path…</p> : collection.isError || !collection.data ? <div className="roadmap-error" role="alert">This learning path is unavailable. <button className="text-button" onClick={() => collection.refetch()}>Try again</button></div> : <>
        <header className="standalone-collection-header">
          {renameTitle === null ? <div className="standalone-collection-title"><h1>{collection.data.title}</h1><button className="button small" aria-label="Rename roadmap" onClick={() => { setError(""); setRenameTitle(collection.data.title); }}><Pencil size={14} /> Rename</button></div> : <form className="standalone-rename-form" aria-label="Rename roadmap" onSubmit={(event) => { event.preventDefault(); const title = renameTitle.trim(); if (!title) { setError("Enter a roadmap name."); return; } setError(""); rename.mutate({ collectionId: id, title }); }}>
            <label>Roadmap name<input value={renameTitle} onChange={(event) => setRenameTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape" && !rename.isPending) setRenameTitle(null); }} autoFocus required maxLength={120} disabled={rename.isPending} /></label>
            <button className="button primary small" disabled={rename.isPending}>{rename.isPending && <LoaderCircle size={14} className="spin" />} Save</button><button type="button" className="button small" disabled={rename.isPending} onClick={() => { setRenameTitle(null); setError(""); }}>Cancel</button>
          </form>}
        </header>
        <div hidden={!building} className="standalone-view"><StandaloneSetup key={id} collection={collection.data} base={base} account={account} onCreated={(roadmap) => {
          client.setQueryData(["roadmap", account, id, roadmap.id], roadmap);
          void client.invalidateQueries({ queryKey: ["roadmaps", account, id] });
          void client.invalidateQueries({ queryKey: listKey });
          setLastPlan({ collectionId: id, id: roadmap.id });
          router.replace(`/roadmaps?collection=${id}`);
        }} /></div>
        <div hidden={building} className="standalone-view"><RoadmapPanel key={`${id}:${lastPlan?.collectionId === id ? lastPlan.id : "history"}`} workspaceId={id} account={account} sources={collection.data.sources ?? []} live={live} active={!building} createRequest={0} apiBase={`${base}/roadmaps`} initialRoadmapId={lastPlan?.collectionId === id ? lastPlan.id : undefined} onCreate={() => router.push(`/roadmaps?collection=${id}&build=1`)} /></div>
      </>}
    </>}
  </section>;
}

export function StandaloneSetup({ collection, base, account, onCreated }: { collection: RoadmapCollection; base: string; account: string; onCreated: (roadmap: LearningRoadmap) => void }) {
  const client = useQueryClient();
  const sources = collection.sources ?? emptySources;
  const [showSource, setShowSource] = useState(false);
  const [topics, setTopics] = useState((collection.topicGoals ?? []).join("\n"));
  const [duration, setDuration] = useState<RoadmapDuration | null>(null);
  const [selected, setSelected] = useState<string[]>(sources.filter((source) => source.status === "READY").map((source) => source.id));
  const [error, setError] = useState("");
  const previous = useRef({ ready: new Set(selected), pending: new Map<string, string>() });
  const collectionKey = ["standalone-collection", account, collection.id];
  useEffect(() => {
    const readyIds = sources.filter((source) => source.status === "READY").map((source) => source.id);
    const known = previous.current;
    setSelected((items) => [...items.filter((id) => readyIds.includes(id)), ...readyIds.filter((id) => !known.ready.has(id))]);
    const removed = [...known.pending].filter(([id]) => !sources.some((source) => source.id === id));
    if (removed.length) setError(`Source upload failed: ${removed.map(([, title]) => title).join(", ")}. Please add the source again.`);
    previous.current = { ready: new Set(readyIds), pending: new Map(sources.filter((source) => source.status === "PENDING" || source.status === "PROCESSING").map((source) => [source.id, source.title])) };
  }, [sources]);
  const add = useMutation({ mutationFn: async (form: FormData) => {
    const type = String(form.get("type")); const title = String(form.get("title") || "").trim();
    if (type === "PDF") {
      const file = form.get("file") as File;
      if (!file?.size || file.size > 10 * 1024 * 1024) throw new Error("Choose a PDF up to 10 MB.");
      const body = new FormData(); body.append("file", file); if (title) body.append("title", title);
      return api<Source>(`${base}/sources/upload`, { method: "POST", body });
    }
    return api<Source>(`${base}/sources${type === "WEBSITE" || type === "YOUTUBE" ? `/import/${type.toLowerCase()}` : ""}`, { method: "POST", body: JSON.stringify(type === "WEBSITE" || type === "YOUTUBE" ? { url: form.get("url"), ...(title ? { title } : {}) } : { type, title, content: form.get("content") }) });
  }, onSuccess: (source) => {
    client.setQueryData<RoadmapCollection>(collectionKey, (current) => current ? { ...current, sources: [source, ...(current.sources ?? [])] } : current);
    setShowSource(false); setError(""); void client.invalidateQueries({ queryKey: collectionKey });
  }, onError: (failure) => setError(`Source upload failed. ${failure.message}`) });
  const remove = useMutation({ mutationFn: (sourceId: string) => api(`${base}/sources/${sourceId}`, { method: "DELETE" }), onSuccess: (_value, sourceId) => {
    client.setQueryData<RoadmapCollection>(collectionKey, (current) => current ? { ...current, sources: current.sources?.filter((source) => source.id !== sourceId) } : current);
    void client.invalidateQueries({ queryKey: collectionKey });
  }, onError: (failure) => setError(failure.message) });
  const generate = useMutation({ mutationFn: () => {
    const topicGoals = parseTopicGoals(topics);
    if (!selected.length && !topicGoals.length) throw new Error("Add at least one source or learning topic.");
    return api<LearningRoadmap>(`${base}/roadmaps`, { method: "POST", body: JSON.stringify({ durationMonths: duration, sourceIds: selected, topicGoals }) });
  }, onSuccess: onCreated, onError: (failure) => setError(failure.message) });
  const pending = sources.some((source) => source.status === "PENDING" || source.status === "PROCESSING");
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setError(""); if (duration && !pending && !generate.isPending) generate.mutate(); };
  return <><form className="standalone-setup" onSubmit={submit}>
    <div className="standalone-intro"><span className="eyebrow">YOUR MATERIALS + YOUR CURIOSITY</span><h2>What do you want to learn?</h2><p>Add sources, extra topics, or both. Your notebook sources and roadmaps stay separate.</p></div>
    {error && <p className="roadmap-error" role="alert">{error}</p>}
    <div className="standalone-input-grid">
      <section className="standalone-input-card"><div className="standalone-card-heading"><h3><FileText size={18} /> Your sources</h3><button type="button" className="button small" disabled={generate.isPending} onClick={() => setShowSource(true)}><Plus size={15} /> Add source</button></div><p>PDFs, websites, YouTube videos, text, and Markdown.</p>
        {!sources.length ? <div className="standalone-source-empty"><FileText size={28} /><p>Add materials to ground your roadmap in what you already have.</p></div> : <div className="standalone-source-list">{sources.map((source) => <div className="standalone-source-row" key={source.id}><label><input type="checkbox" aria-label={`Include ${source.title}`} checked={selected.includes(source.id)} disabled={source.status !== "READY" || generate.isPending} onChange={(event) => setSelected((items) => event.target.checked ? [...items, source.id] : items.filter((id) => id !== source.id))} /><span><strong>{source.title}</strong><small>{source.type} · {source.status === "READY" ? "Ready" : "Processing"}</small></span></label>{source.status === "READY" ? <CheckCircle2 size={15} /> : <LoaderCircle className="spin" size={15} />}<button type="button" className="icon-button" aria-label={`Remove source ${source.title}`} disabled={source.status === "PENDING" || source.status === "PROCESSING" || remove.isPending || generate.isPending} onClick={() => { if (confirm(`Remove ${source.title} from this learning path?`)) remove.mutate(source.id); }}><X size={14} /></button></div>)}</div>}
      </section>
      <section className="standalone-input-card"><h3><Sparkles size={18} /> Topics to include</h3><label className="standalone-topic-label">What else should your roadmap cover?<textarea rows={8} maxLength={4000} value={topics} disabled={generate.isPending} onChange={(event) => setTopics(event.target.value)} placeholder={"Docker\nDeploying a RAG app\nEvaluating retrieval quality"} /></label><p>One topic per line, or separate topics with commas. Up to 20 topics. These are learning goals; web research will find missing study material.</p></section>
    </div>
    <fieldset className="standalone-duration" disabled={generate.isPending}><legend>Choose your learning pace</legend><div className="roadmap-duration-picker">{durationChoices.map((choice) => <label className={duration === choice.months ? "selected" : ""} key={choice.months}><input type="radio" name="standalone-duration" required checked={duration === choice.months} onChange={() => setDuration(choice.months)} /><span className="eyebrow">{choice.pace}</span><strong>{choice.months} {choice.months === 1 ? "Month" : "Months"}</strong><span>{choice.weeks} weeks</span><p>{choice.description}</p></label>)}</div></fieldset>
    {pending && <p className="roadmap-notice" role="status">Your sources are processing. Generation will be available when they’re ready.</p>}
    <div className="standalone-generate"><p>Each generation creates a new roadmap and keeps existing progress intact.</p><button className="button primary" disabled={!duration || (!selected.length && !topics.trim()) || pending || generate.isPending}>{generate.isPending ? <LoaderCircle className="spin" size={17} /> : <Route size={17} />}{generate.isPending ? "Starting your roadmap…" : "Generate my roadmap"}</button></div>
    </form>
    {showSource && <SourceForm live busy={add.isPending} error={add.isError ? `Source upload failed. ${add.error.message}` : undefined} onClose={() => setShowSource(false)} onSubmit={(event) => { event.preventDefault(); event.stopPropagation(); add.mutate(new FormData(event.currentTarget)); }} />}
  </>;
}
