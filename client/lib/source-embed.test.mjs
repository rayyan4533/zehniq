import assert from "node:assert/strict";
import { test } from "node:test";
import { sourceEmbedUrl } from "./source-embed.ts";

test("YouTube watch, short, shorts, live, and embed links use the player endpoint", () => {
  for (const url of [
    "https://www.youtube.com/watch?v=M7lc1UVf-VE&t=5",
    "https://youtu.be/M7lc1UVf-VE?si=share",
    "https://m.youtube.com/shorts/M7lc1UVf-VE",
    "https://youtube.com/live/M7lc1UVf-VE",
    "https://www.youtube-nocookie.com/embed/M7lc1UVf-VE",
  ]) assert.equal(sourceEmbedUrl({ type: "YOUTUBE", url }), "https://www.youtube-nocookie.com/embed/M7lc1UVf-VE");
});

test("websites retain their URL and invalid or unrelated video links are rejected", () => {
  assert.equal(sourceEmbedUrl({ type: "WEBSITE", url: "https://example.com/article?q=notes" }), "https://example.com/article?q=notes");
  for (const url of ["javascript:alert(1)", "not a URL", "https://youtube.com.evil.test/watch?v=M7lc1UVf-VE", "https://youtube.com/watch?v=invalid"]) {
    assert.equal(sourceEmbedUrl({ type: "YOUTUBE", url }), null);
  }
  assert.equal(sourceEmbedUrl({ type: "WEBSITE", url: "javascript:alert(1)" }), null);
  assert.equal(sourceEmbedUrl({ type: "TEXT" }), null);
});
