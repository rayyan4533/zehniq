"use client";
import { useEffect, useState } from "react";
import { Check, Clock3, LoaderCircle, Sparkles } from "lucide-react";
import { tools, type ArtifactType } from "@/lib/notebook";

export function ArtifactLoading({ type, status }: { type: ArtifactType; status: string }) {
  const [takingLonger, setTakingLonger] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setTakingLonger(true), 45000);
    return () => clearTimeout(timer);
  }, []);
  const label = tools.find((tool) => tool.type === type)?.label.toLowerCase() ?? "study material";
  const queued = status === "PENDING";
  return (
    <div className="artifact-loading" aria-busy="true">
      <div className="artifact-loading-heading" role="status" aria-live="polite">
        <span className="artifact-loading-icon"><Sparkles size={27} /></span>
        <span className="eyebrow">A LITTLE THINKING IN PROGRESS</span>
        <h3>{status === "REQUESTING" ? `Preparing your ${label}` : queued ? `Your ${label} is queued` : `Creating your ${label}`}</h3>
        <p>{status === "REQUESTING" ? "Sending your sources to the studio…" : queued ? "Waiting for generation to start. This view updates automatically." : "Turning your sources into something you can learn from."}</p>
      </div>
      <div className="artifact-generation-steps" aria-hidden="true">
        <span className={status === "REQUESTING" ? "current" : "complete"}>{status === "REQUESTING" ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />} Prepare</span>
        <span className={status === "PROCESSING" ? "current" : ""}>{status === "PROCESSING" ? <LoaderCircle size={16} className="spin" /> : <Clock3 size={16} />} Generate</span>
        <span><Check size={16} /> Ready</span>
      </div>
      <div className={`artifact-skeleton ${type === "FLASHCARDS" ? "skeleton-cards" : type === "MINDMAP" ? "skeleton-map" : ""}`} aria-hidden="true">
        <div className="skeleton-block"><i /><i /><i /></div>
        <div className="skeleton-block"><i /><i /><i /></div>
        <div className="skeleton-block"><i /><i /></div>
      </div>
      <p className="artifact-loading-note" role="status">{takingLonger ? "Still working. You can close this window and check back in Studio." : "You can close this window. Your creation will appear in Studio when it’s ready."}</p>
    </div>
  );
}
