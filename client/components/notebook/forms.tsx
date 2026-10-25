"use client";
import {
  useState,
  type FormEvent,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  Plus,
  Trash2,
  LoaderCircle,
  Upload,
  Brain,
  Pencil,
} from "lucide-react";
import type { Workspace, Memory } from "@/lib/notebook";
import { api } from "@/lib/api";
import { Modal } from "./primitives";

export function WorkspaceForm({
  editing,
  busy,
  onClose,
  onSubmit,
  onDelete,
}: {
  editing: Workspace | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onDelete: (w: Workspace) => void;
}) {
  return (
    <Modal
      title={editing ? "Make it your own." : "Every big idea starts somewhere."}
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="stack-form">
        <p className="form-intro">
          Give your notebook a name. The rest is possibility.
        </p>
        <label>
          Notebook name
          <input
            name="title"
            placeholder="My next rabbit hole..."
            required
            maxLength={120}
            defaultValue={editing?.title}
            autoFocus
          />
        </label>
        <label>
          A little context
          <textarea
            name="description"
            rows={3}
            placeholder="What are you curious about?"
            maxLength={500}
            defaultValue={editing?.description ?? ""}
          />
        </label>
        <div className="form-row">
          <label>
            Notebook symbol
            <select name="icon" defaultValue={editing?.icon ?? "📝"}>
              {["📝", "📒", "📓", "🗒️", "📔", "✏️", "✍️"].map((icon) => (
                <option key={icon} value={icon}>{icon}</option>
              ))}
            </select>
          </label>
          <label>
            Default model
            <select
              name="defaultModel"
              defaultValue={editing?.defaultModel ?? "gpt-4o-mini"}
            >
              <option value="gpt-4o-mini">GPT-4o mini</option>
              <option value="gpt-4o">GPT-4o</option>
            </select>
          </label>
        </div>
        <div className="form-actions">
          {editing && (
            <button
              type="button"
              className="button danger"
              disabled={busy}
              onClick={() => onDelete(editing)}
            >
              <Trash2 size={16} /> Delete
            </button>
          )}
          <button className="button primary" disabled={busy}>
            {busy ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <Plus size={16} />
            )}{" "}
            {editing ? "Save changes" : "Create notebook"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function SourceForm({
  busy,
  onClose,
  onSubmit,
  live,
  error,
}: {
  busy: boolean;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  live: boolean;
  error?: string;
}) {
  const [type, setType] = useState("PDF");
  return (
    <Modal title="Feed your curiosity." onClose={onClose}>
      {error && <p className="roadmap-error" role="alert">{error}</p>}
      <p className="form-intro">
        Bring a source. We’ll help you find the good stuff.
      </p>
      <div className="source-type-tabs">
        {["PDF", "WEBSITE", "YOUTUBE", "TEXT", "MARKDOWN"].map((t) => (
          <button
            key={t}
            className={type === t ? "active" : ""}
            onClick={() => setType(t)}
          >
            {t === "WEBSITE"
              ? "Link"
              : t === "YOUTUBE"
                ? "YouTube"
                : t === "MARKDOWN"
                  ? "Markdown"
                  : t === "TEXT"
                    ? "Text"
                    : "PDF"}
          </button>
        ))}
      </div>
      <form className="stack-form" onSubmit={onSubmit}>
        <input type="hidden" name="type" value={type} />
        <label>
          Source title{" "}
          {type === "PDF" || type === "WEBSITE" || type === "YOUTUBE"
            ? "(optional)"
            : ""}
          <input
            name="title"
            placeholder="Give this idea a name"
            required={type === "TEXT" || type === "MARKDOWN"}
            maxLength={200}
          />
        </label>
        {type === "PDF" ? (
          <label className="upload-zone">
            <Upload size={30} />
            <strong>Drop in some food for thought.</strong>
            <span>Choose a PDF · up to 10 MB</span>
            <input name="file" type="file" accept="application/pdf" required />
          </label>
        ) : type === "WEBSITE" || type === "YOUTUBE" ? (
          <label>
            {type === "YOUTUBE" ? "YouTube URL" : "Website URL"}
            <input name="url" type="url" required placeholder="https://..." />
          </label>
        ) : (
          <label>
            Your {type === "MARKDOWN" ? "Markdown" : "notes"}
            <textarea
              name="content"
              required
              rows={7}
              placeholder="Paste your ideas here..."
            />
          </label>
        )}
        {!live && (
          <p className="preview-disclaimer">
            Try text or Markdown locally. File and URL imports require sign-in.
          </p>
        )}
        <button className="button primary" disabled={busy}>
          {busy ? (
            <LoaderCircle size={17} className="spin" />
          ) : (
            <Plus size={17} />
          )}{" "}
          Add source
        </button>
      </form>
    </Modal>
  );
}

export function MemoryPanel({
  memories,
  setMemories,
  live,
  busy,
  run,
  notify,
  onClose,
}: {
  memories: Memory[];
  setMemories: Dispatch<SetStateAction<Memory[]>>;
  live: boolean;
  busy: boolean;
  run: (action: () => Promise<void>) => Promise<void>;
  notify: (text: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal title="A little more you." onClose={onClose}>
      <div className="memory-intro">
        <Brain size={24} />
        <p>
          Tell your notebook how you like to learn. These memories help
          personalize future conversations.
        </p>
      </div>
      <form
        className="memory-form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = e.currentTarget;
          const memory = String(new FormData(f).get("memory"));
          run(async () => {
            const item = live
              ? await api<Memory>("/memory", {
                  method: "POST",
                  body: JSON.stringify({ memory }),
                })
              : { id: crypto.randomUUID(), memory, source: "manual" };
            setMemories((items) => [item, ...items]);
            f.reset();
            notify("A little more you, remembered.");
          });
        }}
      >
        <input
          name="memory"
          required
          placeholder="I learn best with real-world examples..."
          maxLength={2000}
        />
        <button className="button primary" disabled={busy}>
          <Plus size={17} /> Remember
        </button>
      </form>
      <div className="memory-list">
        {memories.map((m) => (
          <div key={m.id}>
            <Brain size={16} />
            <p>{m.memory}</p>
            <button
              className="icon-button"
              aria-label="Edit memory"
              onClick={() => {
                const memory = prompt("Update this memory", m.memory);
                if (memory?.trim())
                  run(async () => {
                    const updated = live
                      ? await api<Memory>(`/memory/${m.id}`, {
                          method: "PATCH",
                          body: JSON.stringify({ memory }),
                        })
                      : { ...m, memory };
                    setMemories((items) =>
                      items.map((x) => (x.id === m.id ? updated : x)),
                    );
                  });
              }}
            >
              <Pencil size={14} />
            </button>
            <button
              className="icon-button"
              aria-label="Delete memory"
              onClick={() => {
                if (confirm("Forget this memory?"))
                  run(async () => {
                    if (live)
                      await api(`/memory/${m.id}`, { method: "DELETE" });
                    setMemories((items) => items.filter((x) => x.id !== m.id));
                  });
              }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {!memories.length && (
          <p className="muted">
            Nothing here yet. Add your first learning preference above.
          </p>
        )}
      </div>
      {!live && (
        <p className="preview-disclaimer">
          Preview memories are stored in this browser. Sign in to use Mem0.
        </p>
      )}
    </Modal>
  );
}
