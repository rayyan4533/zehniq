"use client";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, ExternalLink, FileText, LoaderCircle, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { api } from "@/lib/api";
import { sourceEmbedUrl } from "@/lib/source-embed";
import { roadmapFileUrl, safeResourceUrl, type RoadmapResourceView } from "@/lib/roadmap";

export function RoadmapResourceViewer({ base, resourceId, account, onClose }: { base: string; resourceId: string; account: string; onClose: () => void }) {
  const query = useQuery({ queryKey: ["roadmap-resource", account, base, resourceId], queryFn: () => api<RoadmapResourceView>(`${base}/resources/${encodeURIComponent(resourceId)}`), staleTime: 60000 });
  return (
    <section className="roadmap-resource-pane" aria-label="Learning resource viewer">
      <div className="roadmap-resource-header"><div><span className="eyebrow">YOUR LEARNING WORKSPACE</span><h2>{query.data?.title ?? "Opening resource"}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close resource viewer"><X size={20} /></button></div>
      {query.isPending ? <div className="roadmap-resource-empty" role="status"><LoaderCircle className="spin" size={28} /><p>Opening your resource…</p></div> : query.isError ? <div className="roadmap-resource-empty" role="alert"><FileText size={30} /><h3>This resource is unavailable.</h3><p>{query.error.message}</p><button className="button small" onClick={() => query.refetch()}>Try again</button></div> : <ResourceDisplay key={query.data.id} resource={query.data} />}
    </section>
  );
}

function ResourceDisplay({ resource }: { resource: RoadmapResourceView }) {
  const [showText, setShowText] = useState(false);
  const [page, setPage] = useState(resource.pageNumber ?? 1);
  const [zoom, setZoom] = useState("page-width");
  const url = safeResourceUrl(resource.url);
  const pdfUrl = roadmapFileUrl(resource.filePath);
  const playerUrl = resource.type === "youtube" && url ? sourceEmbedUrl({ type: "YOUTUBE", url }) : null;
  const timestamp = Number.isInteger(resource.timestampSeconds) && resource.timestampSeconds! >= 0 ? resource.timestampSeconds : undefined;
  const videoUrl = playerUrl ? `${playerUrl}${timestamp !== undefined ? `?start=${timestamp}` : ""}` : null;
  const text = resource.content?.trim();
  const canEmbed = resource.type === "pdf" ? !!pdfUrl : resource.type === "youtube" ? !!videoUrl : resource.type === "website" && !!url;
  return (
    <>
      <div className="roadmap-resource-meta"><span className="tiny-tag">{resource.type.toUpperCase()}</span><span>{resource.origin === "uploaded" ? "Your uploaded source" : "Discovered through web research"}</span></div>
      {resource.description && <details className="roadmap-resource-about"><summary>About this resource</summary><p className="roadmap-resource-description">{resource.description}</p></details>}
      {resource.sectionTitle && <p className="roadmap-resource-description">Section: {resource.sectionTitle}</p>}
      <div className="roadmap-reader-actions">
        {canEmbed && text && <button className="button small" onClick={() => setShowText((value) => !value)}>{showText ? "View original" : resource.type === "youtube" ? "Read transcript" : "Read extracted text"}</button>}
        {(url || pdfUrl) && <a className="button small" href={pdfUrl ?? url!} target="_blank" rel="noopener noreferrer">Open in new tab <ExternalLink size={14} /></a>}
      </div>
      {resource.type === "pdf" && pdfUrl && !showText && <>
        <div className="roadmap-pdf-controls" aria-label="PDF controls">
          <button className="icon-button" aria-label="Previous PDF page" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ArrowLeft size={16} /></button>
          <label>Page <input aria-label="PDF page number" type="number" min={1} max={resource.pageCount} value={page} onChange={(event) => { const value = Number(event.target.value); if (Number.isInteger(value) && value >= 1 && (!resource.pageCount || value <= resource.pageCount)) setPage(value); }} />{resource.pageCount ? ` of ${resource.pageCount}` : ""}</label>
          <button className="icon-button" aria-label="Next PDF page" disabled={!!resource.pageCount && page >= resource.pageCount} onClick={() => setPage((value) => value + 1)}><ArrowRight size={16} /></button>
          <label>Zoom <select aria-label="PDF zoom" value={zoom} onChange={(event) => setZoom(event.target.value)}><option value="page-width">Fit width</option><option value="75">75%</option><option value="100">100%</option><option value="125">125%</option><option value="150">150%</option><option value="200">200%</option></select></label>
        </div>
        <PdfPreview key={pdfUrl} fileUrl={pdfUrl} title={resource.title} page={page} zoom={zoom} />
        <p className="roadmap-reader-note">PDF display depends on your browser. If the preview cannot open, try the new-tab button or read the extracted text.</p>
      </>}
      {resource.type === "youtube" && videoUrl && !showText && <>
        <iframe className="roadmap-resource-frame video" title={`YouTube: ${resource.title}`} src={videoUrl} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
        <p className="roadmap-reader-note">Some videos restrict embedded playback. Use “Open in new tab” if the player is unavailable.</p>
      </>}
      {resource.type === "website" && url && !showText && <>
        <p className="roadmap-reader-note">This website may block embedded viewing. If the page is blank or refuses to connect, use “Open in new tab”{text ? " or read the extracted text" : ""}.</p>
        <iframe className="roadmap-resource-frame website" title={`Website: ${resource.title}`} src={url} sandbox="allow-scripts allow-same-origin allow-forms allow-presentation" referrerPolicy="strict-origin-when-cross-origin" />
      </>}
      {(showText || !canEmbed || resource.type === "text" || resource.type === "markdown") && (text ? <article className="roadmap-document markdown"><ReactMarkdown components={{ a: ({ href, children }) => { const safe = safeResourceUrl(href); return safe ? <a href={safe} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span>; } }}>{text}</ReactMarkdown></article> : <div className="roadmap-resource-empty"><FileText size={30} /><h3>No readable text is available.</h3><p>{url ? "Use the original resource link above to continue." : "The source may have been removed or is no longer accessible."}</p></div>)}
    </>
  );
}

export function PdfPreview({ fileUrl, title, page, zoom }: { fileUrl: string; title: string; page: number; zoom: string }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | undefined;
    void (async () => {
      try {
        const response = await fetch(fileUrl, { credentials: "include", signal: controller.signal });
        if (!response.ok || !response.headers.get("content-type")?.includes("application/pdf")) throw new Error("PDF unavailable");
        const blob = await response.blob();
        if (!blob.size) throw new Error("PDF unavailable");
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
        setLoading(false);
      } catch {
        if (!controller.signal.aborted) { setFailed(true); setLoading(false); }
      }
    })();
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [fileUrl, attempt]);
  if (loading) return <div className="roadmap-resource-empty" role="status"><LoaderCircle className="spin" size={27} /><p>Loading your PDF…</p></div>;
  if (failed || !blobUrl) return <div className="roadmap-resource-empty" role="alert"><FileText size={30} /><h3>This PDF couldn’t be opened.</h3><p>Try again, open it in a new tab, or read the extracted text when available.</p><button className="button small" onClick={() => { setFailed(false); setLoading(true); setBlobUrl(null); setAttempt((value) => value + 1); }}>Try PDF again</button></div>;
  return <iframe className="roadmap-resource-frame pdf" title={`PDF: ${title}`} src={`${blobUrl}#page=${page}&${zoom === "page-width" ? "view=FitH" : `zoom=${zoom}`}`} />;
}
