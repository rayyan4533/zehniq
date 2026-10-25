"use client";
import { useEffect, useRef, type ReactNode } from "react";
import {
  X,
  ArrowUpRight,
  FileText,
  Layers,
  Network,
  Lightbulb,
  ClipboardList,
  CircleHelp,
} from "lucide-react";
export function ToolIcon({ name, size = 22 }: { name: string; size?: number }) {
  const Icon =
    (
      {
        file: FileText,
        cards: Layers,
        map: Network,
        bulb: Lightbulb,
        report: ClipboardList,
        quiz: CircleHelp,
      } as Record<string, typeof FileText>
    )[name] ?? FileText;
  return <Icon size={size} strokeWidth={1.8} />;
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function NotebookArt() {
  return (
    <div className="notebook-art" aria-hidden="true">
      <span className="art-star">✳</span>
      <div className="book-back" />
      <div className="book-cover">
        <div className="book-binding" />
        <span className="book-label">
          BIG IDEAS
          <br />
          START HERE.
        </span>
        <span className="book-doodle">↗</span>
        <span className="book-foot">VOL. 01 / YOUR MIND</span>
      </div>
      <span className="art-sticker">
        THINK
        <br />
        OUTSIDE
        <br />
        THE TAB.
      </span>
      <ArrowUpRight className="art-arrow" size={50} />
    </div>
  );
}
