import { Suspense } from "react";
import { NotebookApp } from "@/components/notebook/notebook-app";

export default function RoadmapsPage() {
  return <Suspense fallback={<p>Opening Roadmap Builder…</p>}><NotebookApp standaloneRoadmaps /></Suspense>;
}
