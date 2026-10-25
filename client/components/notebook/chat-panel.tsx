"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import {
  ArrowUp,
  ArrowUpRight,
  BookOpen,
  Globe,
  MessageSquare,
  Plus,
  Square,
  Download,
  Trash2,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";
import type { Workspace, Source, Conversation } from "@/lib/notebook";
type Citation = {
  sourceId?: string;
  sourceTitle: string;
  excerpt?: string;
  url?: string;
  page?: number;
};
type StoredMessage = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  citations?: Citation[];
};
function textOf(message: UIMessage) {
  return message.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("");
}

export function ChatPanel({
  workspace,
  sources,
  live,
  onError,
}: {
  workspace: Workspace;
  sources: Source[];
  live: boolean;
  onError: (error: string) => void;
}) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const conversationRef = useRef<string | null>(null);
  const activeWorkspaceIdRef = useRef<string>(workspace.id);
  const initialLoadedWorkspaceRef = useRef<string | null>(null);
  const userInitiatedNewChatRef = useRef(false);
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [webSearch, setWebSearch] = useState(false);
  const [model, setModel] = useState(workspace.defaultModel);
  const [previewMessages, setPreviewMessages] = useState<UIMessage[]>([]);
  const [citations, setCitations] = useState<Record<string, Citation[]>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const conversationKey = ["conversations", workspace.id];
  const conversationsQuery = useQuery({
    queryKey: conversationKey,
    queryFn: () =>
      api<Conversation[]>(`/workspaces/${workspace.id}/conversations`),
    enabled: live,
  });
  const conversations = conversationsQuery.data ?? [];
  const reloadConversations = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: ["conversations", workspace.id],
    });
  }, [queryClient, workspace.id]);
  const fetchMessages = useCallback(
    (id: string) =>
      queryClient.fetchQuery({
        queryKey: ["messages", workspace.id, id],
        queryFn: () =>
          api<StoredMessage[]>(
            `/workspaces/${workspace.id}/conversations/${id}/messages`,
          ),
        staleTime: 0,
      }),
    [queryClient, workspace.id],
  );
  const removeConversation = useMutation({
    mutationFn: (id: string) =>
      api(`/workspaces/${workspace.id}/conversations/${id}`, {
        method: "DELETE",
      }),
    onSuccess: reloadConversations,
  });
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `/api/workspaces/${workspace.id}/chat`,
        credentials: "include",
        fetch: async (url, init) => {
          const response = await fetch(url, {
            ...init,
            credentials: "include",
          });
          const id = response.headers.get("X-Conversation-Id");
          if (id) {
            conversationRef.current = id;
            setConversationId(id);
            userInitiatedNewChatRef.current = false;
          }
          return response;
        },
      }),
    [workspace.id],
  );
  const chat = useChat({
    transport,
    onFinish: ({ message }) => {
      reloadConversations();
      const id = conversationRef.current;
      if (live && id)
        fetchMessages(id)
          .then((items) => {
            const latest = items.filter((m) => m.role === "ASSISTANT").at(-1);
            setCitations((current) => ({
              ...current,
              ...Object.fromEntries(
                items.map((m) => [m.id, m.citations ?? []]),
              ),
              [message.id]: latest?.citations ?? [],
            }));
          })
          .catch(() => {});
    },
  });
  const messages = live ? chat.messages : previewMessages;
  const streaming = chat.status === "streaming" || chat.status === "submitted";
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  const loadConversation = useCallback(
    async (id: string) => {
      if (streaming) return;
      try {
        userInitiatedNewChatRef.current = false;
        const items = await fetchMessages(id);
        setConversationId(id);
        conversationRef.current = id;
        chat.setMessages(
          items.map((m) => ({
            id: m.id,
            role: m.role === "USER" ? "user" : "assistant",
            parts: [{ type: "text", text: m.content }],
          })),
        );
        setCitations(
          Object.fromEntries(items.map((m) => [m.id, m.citations ?? []])),
        );
      } catch (e) {
        onError(e instanceof Error ? e.message : "Could not load conversation.");
      }
    },
    [streaming, fetchMessages, chat, onError],
  );

  const newChat = useCallback(() => {
    if (streaming) return;
    userInitiatedNewChatRef.current = true;
    setConversationId(null);
    conversationRef.current = null;
    chat.setMessages([]);
    setPreviewMessages([]);
    setCitations({});
  }, [streaming, chat]);

  useEffect(() => {
    if (activeWorkspaceIdRef.current !== workspace.id) {
      activeWorkspaceIdRef.current = workspace.id;
      userInitiatedNewChatRef.current = false;
      initialLoadedWorkspaceRef.current = null;
      setConversationId(null);
      conversationRef.current = null;
      chat.setMessages([]);
      setPreviewMessages([]);
      setCitations({});
    }

    if (!live || !conversations.length) return;
    if (userInitiatedNewChatRef.current) return;

    // Automatically open the previous (most recent) chat
    if (
      initialLoadedWorkspaceRef.current !== workspace.id &&
      !conversationId &&
      !conversationRef.current
    ) {
      initialLoadedWorkspaceRef.current = workspace.id;
      loadConversation(conversations[0].id);
    }
  }, [live, conversations, conversationId, workspace.id, loadConversation, chat]);

  async function send(text = input) {
    if (!text.trim() || streaming) return;
    setInput("");
    userInitiatedNewChatRef.current = false;
    if (live) {
      await chat.sendMessage(
        { text },
        {
          body: {
            ...(conversationId ? { conversationId } : {}),
            model,
            webSearch,
            sourceIds: sources.filter((source) => source.status === "READY").map((source) => source.id),
          },
        },
      );
    } else {
      const ready = sources.filter((s) => s.status === "READY");
      const answer = ready.length
        ? `**Preview response** — this is a local illustration, not a live AI answer.\n\nHere’s something from **${ready[0].title}**:\n\n> ${ready[0].content?.slice(0, 450) ?? "This source is ready to explore."}\n\nSign in to ask “${text}” across your sources with AI and citations.`
        : "Add a text or Markdown source first, then ask a question. Sign in to enable live AI answers.";
      setPreviewMessages((items) => [
        ...items,
        {
          id: crypto.randomUUID(),
          role: "user",
          parts: [{ type: "text", text }],
        },
        {
          id: crypto.randomUUID(),
          role: "assistant",
          parts: [{ type: "text", text: answer }],
        },
      ]);
    }
  }

  async function deleteChat() {
    if (!conversationId || !confirm("Delete this conversation?")) return;
    try {
      const deletedId = conversationId;
      await removeConversation.mutateAsync(deletedId);
      const remaining = conversations.filter((c) => c.id !== deletedId);
      if (remaining.length > 0) {
        await loadConversation(remaining[0].id);
      } else {
        newChat();
      }
      reloadConversations();
    } catch (e) {
      onError(
        e instanceof Error ? e.message : "Could not delete conversation.",
      );
    }
  }

  function exportChat() {
    const text = messages
      .map((m) => `## ${m.role}\n\n${textOf(m)}`)
      .join("\n\n");
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/markdown" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${workspace.title}-chat.md`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section className="chat-panel">
      <div className="panel-heading">
        <h2>
          <MessageSquare size={18} /> The conversation
        </h2>
        <div className="inline-actions">
          <button
            className="icon-button"
            disabled={!messages.length}
            onClick={exportChat}
            aria-label="Export conversation"
            title="Export conversation"
          >
            <Download size={16} />
          </button>
          {conversationId && (
            <button
              className="icon-button"
              disabled={streaming}
              onClick={deleteChat}
              aria-label="Delete conversation"
              title="Delete conversation"
            >
              <Trash2 size={16} />
            </button>
          )}
          <button
            className="icon-button"
            onClick={newChat}
            disabled={streaming}
            aria-label="New conversation"
            title="New conversation"
          >
            <Plus size={19} />
          </button>
        </div>
      </div>
      {live && (conversations.length > 0 || conversationId) && (
        <div className="history-bar">
          <label className="history-select" title="Switch to a previous chat">
            <MessageSquare size={13} className="history-icon" />
            <select
              value={conversationId ?? ""}
              disabled={streaming}
              onChange={(e) =>
                e.target.value ? loadConversation(e.target.value) : newChat()
              }
            >
              {conversationId === null && (
                <option value="">New conversation</option>
              )}
              {conversations.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title ?? "Untitled conversation"}
                </option>
              ))}
              {conversationId !== null && (
                <option value="">+ New conversation</option>
              )}
            </select>
            <ChevronDown size={14} className="history-chevron" />
          </label>
          <button
            type="button"
            className="new-chat-button"
            onClick={newChat}
            disabled={streaming}
            title="Start new chat"
          >
            <Plus size={14} />
            <span>New chat</span>
          </button>
        </div>
      )}
      <div className={`chat-messages ${messages.length ? "has-messages" : ""}`}>
        {messages.length === 0 ? (
          <div className="chat-welcome">
            <div className="chat-emblem">
              <Sparkles size={32} />
              <span>✳</span>
            </div>
            <span className="eyebrow">LET’S FOLLOW YOUR CURIOSITY.</span>
            <h2>
              Good questions.
              <br />
              <span>Great discoveries.</span>
            </h2>
            <p>
              Your sources have a lot to say.
              <br />
              Pull up a chair. Ask them anything.
            </p>
            <div className="suggestion-list">
              {[
                "Give me the big picture",
                "What are the key ideas?",
                "Connect the dots between my sources",
              ].map((text) => (
                <button key={text} onClick={() => send(text)}>
                  {text}
                  <ArrowUpRight size={15} />
                </button>
              ))}
            </div>
            <span className="grounded-label">
              <BookOpen size={13} />
              {sources.filter((s) => s.status === "READY").length} sources. A
              whole lot of possibility.
            </span>
          </div>
        ) : (
          messages.map((m) => (
            <article key={m.id} className={`chat-message ${m.role}`}>
              <div className="message-avatar">
                {m.role === "user" ? "Y" : <Sparkles size={17} />}
              </div>
              <div>
                <span className="message-author">
                  {m.role === "user" ? "YOU" : "zehniq."}
                </span>
                <div className="markdown">
                  <ReactMarkdown>{textOf(m)}</ReactMarkdown>
                </div>
                {citations[m.id]?.length > 0 && (
                  <details className="citations">
                    <summary>
                      {citations[m.id].length} source references
                    </summary>
                    {citations[m.id].map((c, i) => (
                      <div key={i}>
                        <strong>
                          [{i + 1}] {c.sourceTitle}
                          {c.page ? ` · page ${c.page}` : ""}
                        </strong>
                        <p>{c.excerpt}</p>
                        {c.url && (
                          <a href={c.url} target="_blank" rel="noreferrer">
                            Open source ↗
                          </a>
                        )}
                      </div>
                    ))}
                  </details>
                )}
              </div>
            </article>
          ))
        )}
        {streaming && (
          <div className="thinking">
            <span />
            <span />
            <span /> Connecting the dots...
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      {chat.error && (
        <p role="alert" className="chat-error">
          {chat.error.message}
        </p>
      )}
      <div className="composer-area">
        <form
          className="chat-composer"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <textarea
            aria-label="Ask your notebook"
            placeholder="What’s on your curious mind?"
            value={input}
            rows={2}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                send();
              }
            }}
          />
          <div className="composer-bottom">
            <button
              type="button"
              className={`web-search ${webSearch ? "enabled" : ""}`}
              onClick={() => setWebSearch(!webSearch)}
              aria-pressed={webSearch}
            >
              <Globe size={15} /> Web search
            </button>
            <select
              aria-label="AI model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              <option value="gpt-4o-mini">GPT-4o mini</option>
              <option value="gpt-4o">GPT-4o</option>
            </select>
            {streaming ? (
              <button
                type="button"
                className="send-button"
                onClick={() => chat.stop()}
                aria-label="Stop generation"
              >
                <Square size={16} />
              </button>
            ) : (
              <button
                className="send-button"
                disabled={!input.trim()}
                aria-label="Send message"
              >
                <ArrowUp size={21} />
              </button>
            )}
          </div>
        </form>
        <p className="composer-footnote">
          {live
            ? "Grounded in your sources. Always worth a second look."
            : "Preview mode · Sign in for live AI answers"}
        </p>
      </div>
    </section>
  );
}
