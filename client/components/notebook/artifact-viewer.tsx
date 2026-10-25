"use client";
import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Check,
  Download,
  TriangleAlert,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { Artifact } from "@/lib/notebook";
import { Modal } from "./primitives";
import { ArtifactLoading } from "./artifact-loading";
import { MindmapViewer } from "./mindmap-viewer";
type Content = {
  cards?: { front: string; back: string }[];
  questions?: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }[];
  nodes?: { id: string; label: string }[];
  edges?: { id: string; source: string; target: string }[];
  items?: string[];
  markdown?: string;
  summary?: string;
  sections?: { title: string; content: string }[];
};
export function ArtifactViewer({
  artifact,
  onClose,
}: {
  artifact: Artifact;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const c = (
    typeof artifact.content === "object" && artifact.content
      ? artifact.content
      : {}
  ) as Content;
  function download() {
    const blob = new Blob([JSON.stringify(artifact.content, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${artifact.title}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  const cards = c.cards ?? [];
  return (
    <Modal title={artifact.title} onClose={onClose} wide>
      <div className="artifact-toolbar">
        <span className="eyebrow">{artifact.type.replaceAll("_", " ")}</span>
        <button className="button small" onClick={download} disabled={artifact.status !== "READY"}>
          <Download size={15} /> Export
        </button>
      </div>
      {artifact.status !== "READY" ? (
        artifact.status === "FAILED" ? (
          <div className="artifact-generation-error" role="alert">
            <TriangleAlert size={30} />
            <h3>We couldn’t create this one.</h3>
            <p>Your sources are still here. Head back to Studio and try generating it again.</p>
            <button className="button" onClick={onClose}>Back to Studio</button>
          </div>
        ) : <ArtifactLoading type={artifact.type} status={artifact.status} />
      ) : (
        <>
          {artifact.type === "FLASHCARDS" && cards.length > 0 && (
            <>
              <button
                className={`flashcard ${flipped ? "flipped" : ""}`}
                onClick={() => setFlipped(!flipped)}
              >
                <span className="eyebrow">
                  {flipped ? "THE ANSWER" : "THE QUESTION"}
                </span>
                <h2>{flipped ? cards[index].back : cards[index].front}</h2>
                <span>
                  <RotateCcw size={15} /> Click to flip
                </span>
              </button>
              <div className="card-pagination">
                <button
                  className="icon-button"
                  disabled={index === 0}
                  onClick={() => {
                    setIndex(index - 1);
                    setFlipped(false);
                  }}
                  aria-label="Previous card"
                >
                  <ChevronLeft />
                </button>
                <span>
                  {index + 1} / {cards.length}
                </span>
                <button
                  className="icon-button"
                  disabled={index === cards.length - 1}
                  onClick={() => {
                    setIndex(index + 1);
                    setFlipped(false);
                  }}
                  aria-label="Next card"
                >
                  <ChevronRight />
                </button>
              </div>
            </>
          )}
          {artifact.type === "QUIZ" && (
            <div className="quiz-list">
              {c.questions?.map((q, i) => (
                <section key={i} className="quiz-question">
                  <span className="eyebrow">QUESTION {i + 1}</span>
                  <h3>{q.question}</h3>
                  {q.options.map((option, j) => (
                    <button
                      key={j}
                      className={`quiz-option ${answers[i] === j ? (j === q.correctIndex ? "correct" : "incorrect") : ""} ${answers[i] !== undefined && j === q.correctIndex ? "correct" : ""}`}
                      disabled={answers[i] !== undefined}
                      onClick={() => setAnswers({ ...answers, [i]: j })}
                    >
                      <span>{String.fromCharCode(65 + j)}</span>
                      {option}
                      {answers[i] !== undefined && j === q.correctIndex && (
                        <Check size={18} />
                      )}
                    </button>
                  ))}
                  {answers[i] !== undefined && (
                    <p className="explanation">{q.explanation}</p>
                  )}
                </section>
              ))}
              <button className="button" onClick={() => setAnswers({})}>
                <RotateCcw size={16} /> Start again
              </button>
            </div>
          )}
          {artifact.type === "MINDMAP" && (
            <MindmapViewer nodes={c.nodes ?? []} edges={c.edges ?? []} />
          )}
          {artifact.type === "TAKEAWAYS" && (
            <ol className="takeaways">
              {c.items?.map((item, i) => (
                <li key={i}>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <p>{item}</p>
                </li>
              ))}
            </ol>
          )}
          {(artifact.type === "SUMMARY" || artifact.type === "REPORT") && (
            <div className="markdown">
              <ReactMarkdown>
                {typeof artifact.content === "string"
                  ? artifact.content
                  : (c.markdown ??
                    c.summary ??
                    c.sections
                      ?.map((s) => `## ${s.title}\n${s.content}`)
                      .join("\n\n") ??
                    "No content available.")}
              </ReactMarkdown>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
