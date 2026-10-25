import type { Source } from "./notebook";

export function sourceEmbedUrl(source: Pick<Source, "type" | "url" | "metadata">): string | null {
  if (source.type !== "WEBSITE" && source.type !== "YOUTUBE") return null;
  try {
    const url = new URL(source.url ?? "");
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (source.type === "WEBSITE") return url.href;
    const host = url.hostname.toLowerCase();
    let id: string | null = null;
    if (host === "youtu.be") id = url.pathname.split("/")[1] ?? null;
    else if (["youtube.com", "www.youtube.com", "m.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"].includes(host)) {
      id = url.searchParams.get("v");
      if (!id && /^\/(embed|shorts|live)\//.test(url.pathname)) id = url.pathname.split("/")[2] ?? null;
    }
    return id && /^[\w-]{11}$/.test(id)
      ? `https://www.youtube-nocookie.com/embed/${id}`
      : null;
  } catch {
    return null;
  }
}
