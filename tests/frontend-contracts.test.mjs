import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const authenticatedPages = [
  "dashboard/index.html",
  "onboarding/index.html",
  "profclass/index.html",
  "studentclass/index.html",
  "Syntax.html"
];

test("every authenticated page can sync theme preferences through ApiClient", () => {
  for (const page of authenticatedPages) {
    const html = read(page);
    const apiClientIndex = html.indexOf("api-client.js");
    const themeIndex = html.indexOf("theme.js");

    assert.match(html, /<meta\s+name=["']viewport["']/i, `${page} needs a viewport meta tag`);
    assert.ok(apiClientIndex >= 0, `${page} must load api-client.js`);
    assert.ok(themeIndex > apiClientIndex, `${page} must load api-client.js before theme.js`);
  }
});

test("Echo is installed consistently on authenticated working pages", () => {
  for (const page of [
    "dashboard/index.html",
    "profclass/index.html",
    "studentclass/index.html",
    "Syntax.html"
  ]) {
    const html = read(page);
    assert.match(html, /frontend\/css\/chatbot\.css/);
    assert.match(html, /frontend\/script\/chatbot\.js/);
  }
});

test("production frontend contains no stale Railway backend domain", () => {
  for (const script of [
    "frontend/script/api-client.js",
    "frontend/script/script.js"
  ]) {
    const source = read(script);
    assert.doesNotMatch(source, /codetracker-production-ab72/i);
    assert.match(source, /codetracker-production-979d/i);
  }
});

test("Echo mobile CSS covers compact, narrow, landscape, and safe-area layouts", () => {
  const css = read("frontend/css/chatbot.css");
  assert.match(css, /@media\s*\(max-width:\s*700px\)/);
  assert.match(css, /@media\s*\(max-width:\s*480px\)/);
  assert.match(css, /orientation:\s*landscape/);
  assert.match(css, /100dvh/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /\.chatbot-threads-panel[\s\S]*width:\s*100%/);
});

test("theme and Echo use the new account persistence endpoints", () => {
  assert.match(read("frontend/script/theme.js"), /\/users\/preferences\/theme/);
  const chatbot = read("frontend/script/chatbot.js");
  assert.match(chatbot, /\/chatbot\/threads/);
  assert.match(chatbot, /threadId/);
  assert.match(chatbot, /Load older messages/);
});
