import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import { BlockList, isIP } from "node:net";
import { createHash } from "node:crypto";
import { searchWeb, type TavilySearchResult } from "../../lib/website-search-chat-tool/tavily.js";
import type { RoadmapAnalysis, RoadmapResource } from "./roadmap.schema.js";

const blockedV4 = new BlockList();
const blockedV6 = new BlockList();
for (const [address, prefix] of [
    ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
    ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
    ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
    ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) blockedV4.addSubnet(address, prefix, "ipv4");
for (const [address, prefix] of [["::", 128], ["::1", 128], ["::ffff:0:0", 96], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8], ["2001:db8::", 32], ["2001::", 23], ["2002::", 16]] as const) blockedV6.addSubnet(address, prefix, "ipv6");

export function isPublicAddress(address: string): boolean {
    const family = isIP(address);
    if (!family) return false;
    if (family === 4) return !blockedV4.check(address, "ipv4");
    // Only globally routable unicast is eligible; mapped, link-local and special
    // IPv6 ranges are deliberately excluded.
    return /^[23]/i.test(address) && !blockedV6.check(address, "ipv6");
}

export function publicWebUrl(input: string): URL {
    const url = new URL(input);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || (url.port && !["80", "443"].includes(url.port))) throw new Error("Unsupported resource URL");
    const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || (!isIP(host) && !host.includes("."))) throw new Error("Resource URL is not public");
    if (isIP(host) && !isPublicAddress(host)) throw new Error("Resource URL is not public");
    url.hash = "";
    return url;
}

/** Bounded public-page fetch. DNS is validated and pinned for the actual request,
 * and each redirect is revalidated, avoiding DNS-rebinding and redirect SSRF. */
export async function fetchPublicPage(input: string, redirects = 0, deadline = Date.now() + 15_000): Promise<{ url: string; title: string; text: string }> {
    if (redirects > 3) throw new Error("Too many resource redirects");
    const url = publicWebUrl(input);
    const hostname = url.hostname.replace(/^\[|\]$/g, "");
    const remainingMs = () => Math.max(1, Math.min(7000, deadline - Date.now()));
    if (deadline <= Date.now()) throw new Error("Resource verification timed out");
    let dnsTimer: ReturnType<typeof setTimeout> | undefined;
    const addresses = await Promise.race([
        lookup(hostname, { all: true, verbatim: true }),
        new Promise<never>((_resolve, reject) => { dnsTimer = setTimeout(() => reject(new Error("Resource DNS lookup timed out")), remainingMs()); }),
    ]).finally(() => clearTimeout(dnsTimer));
    if (!addresses.length || addresses.some((item) => !isPublicAddress(item.address))) throw new Error("Resource resolved to a private address");
    const address = addresses.find((item) => item.family === 4) ?? addresses[0]!;
    const result = await new Promise<{ status: number; location: string | undefined; contentType: string; body: string }>((resolve, reject) => {
        const makeRequest = url.protocol === "https:" ? httpsRequest : httpRequest;
        const request = makeRequest(url, {
            method: "GET", agent: false, family: address.family,
            headers: { "User-Agent": "Zehniq-Resource-Check/1.0", Accept: "text/html,text/plain", "Accept-Encoding": "identity" },
            lookup: (_host, _options, callback) => callback(null, address.address, address.family),
        }, (response) => {
            const status = response.statusCode ?? 0;
            const location = response.headers.location;
            const contentType = response.headers["content-type"] ?? "";
            if (status >= 300 && status < 400) { response.destroy(); resolve({ status, location, contentType, body: "" }); return; }
            if (status < 200 || status >= 300 || !/text\/(html|plain)|application\/xhtml\+xml/i.test(contentType)) { response.destroy(); reject(new Error("Resource is unavailable or not a readable webpage")); return; }
            const chunks: Buffer[] = [];
            let bytes = 0;
            let done = false;
            const finish = () => { if (!done) { done = true; resolve({ status, location, contentType, body: Buffer.concat(chunks).toString("utf8") }); } };
            response.on("data", (chunk: Buffer) => {
                const remaining = 192_000 - bytes;
                if (remaining > 0) { chunks.push(chunk.subarray(0, remaining)); bytes += Math.min(remaining, chunk.length); }
                if (bytes >= 192_000) { finish(); response.destroy(); }
            });
            response.on("end", finish);
            response.on("error", (error) => { if (!done) reject(error); });
        });
        const timer = setTimeout(() => request.destroy(new Error("Resource verification timed out")), remainingMs());
        request.once("close", () => clearTimeout(timer));
        request.setTimeout(remainingMs(), () => request.destroy(new Error("Resource verification timed out")));
        request.on("error", reject);
        request.end();
    });
    if (result.status >= 300 && result.status < 400) {
        if (!result.location) throw new Error("Resource redirect has no destination");
        return fetchPublicPage(new URL(result.location, url).href, redirects + 1, deadline);
    }
    const title = result.body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() ?? "";
    const text = result.body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return { url: url.href, title: title.slice(0, 300), text: text.slice(0, 30_000) };
}

const stopWords = new Set(["about", "learn", "learning", "guide", "tutorial", "official", "documentation", "beginner", "advanced", "introduction", "the", "and", "with", "for", "from", "what", "how", "using", "into", "your", "best", "resources"]);
function topicWords(input: string) {
    return [...new Set(input.toLowerCase().match(/[a-z0-9][a-z0-9+#.-]{1,}/g) ?? [])].filter((word) => !stopWords.has(word));
}

export async function verifyResearchResult(result: TavilySearchResult, topic: string): Promise<RoadmapResource | null> {
    if (!result.title.trim() || !result.content.trim() || (result.score !== undefined && result.score < 0.25)) return null;
    const page = await fetchPublicPage(result.url);
    const words = topicWords(topic);
    const searchable = `${page.title} ${page.text}`.toLowerCase();
    const matchingWords = words.filter((word) => new RegExp(`(^|[^a-z0-9])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^a-z0-9])`, "i").test(searchable));
    if (!words.length || matchingWords.length < Math.min(2, words.length)) return null;
    if (!page.title) return null;
    const host = new URL(page.url).hostname.toLowerCase();
    const youtube = ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"].includes(host);
    return {
        id: `web-${createHash("sha256").update(page.url).digest("hex").slice(0, 20)}`,
        title: page.title.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"'),
        type: youtube ? "youtube" : "website", origin: "web", url: page.url,
        description: `Supplement for ${topic}. ${result.content.slice(0, 600)}`.slice(0, 1000),
    };
}

type ResearchDependencies = {
    configured: () => boolean;
    search: typeof searchWeb;
    verify: typeof verifyResearchResult;
};
const defaults: ResearchDependencies = { configured: () => !!process.env.TAVILY_API_KEY?.trim(), search: searchWeb, verify: verifyResearchResult };

async function boundedSearch(search: typeof searchWeb, query: string) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    return Promise.race([
        search(query),
        new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error("Web search timed out")), 15_000); }),
    ]).finally(() => clearTimeout(timer));
}

export async function researchRoadmapResources(analysis: RoadmapAnalysis, deps: ResearchDependencies = defaults) {
    const resources: RoadmapResource[] = [];
    const limitations: string[] = [];
    if (!analysis.gaps.length) return { resources, limitations };
    const configured = deps.configured();
    if (!configured) limitations.push("Web search is unavailable because the search integration is not configured. Model-suggested resources are included only if independently verified; other gaps may need additional material.");
    for (const gap of analysis.gaps.slice(0, 3)) {
        const topic = analysis.topics.find((item) => item.id === gap.topicId)?.title ?? analysis.subject;
        const suggested = await Promise.allSettled((gap.candidateUrls ?? []).slice(0, 2).map((url) => deps.verify({ url, title: topic, content: `Model-suggested educational material about ${topic}.` }, topic)));
        const verifiedSuggestions = suggested.flatMap((item) => item.status === "fulfilled" && item.value ? [{ ...item.value, description: `Model-suggested resource, independently verified for ${topic}.` }] : []);
        resources.push(...verifiedSuggestions);
        if (!configured) {
            if (!verifiedSuggestions.length) limitations.push(`No resource could be independently verified for “${topic}”.`);
            continue;
        }
        try {
            const result = await boundedSearch(deps.search, `${gap.searchQuery} official documentation educational tutorial`);
            // Search rankings are used to prefer useful results. Unverified
            // candidates never enter the planner's resource catalog.
            const checked = await Promise.allSettled(result.results.slice(0, 4).map((candidate) => deps.verify(candidate, topic)));
            const accepted = checked.flatMap((item) => item.status === "fulfilled" && item.value ? [item.value] : []).slice(0, 2);
            resources.push(...accepted);
            if (!accepted.length && !verifiedSuggestions.length) limitations.push(`No accessible, relevant resource could be verified for “${topic}”.`);
        } catch {
            limitations.push(`Web research was unavailable for “${topic}”. Uploaded resources remain the foundation of this roadmap.`);
        }
    }
    return { resources: [...new Map(resources.map((resource) => [resource.id, resource])).values()], limitations };
}
