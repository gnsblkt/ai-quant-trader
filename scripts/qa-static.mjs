import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Script } from "node:vm";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const htmlPath = resolve(root, "quantreplay/index.html");
const html = await readFile(htmlPath, "utf8");

const requiredIds = [
  "chart", "symbol", "tf", "ind", "play", "back", "next", "last",
  "cursor", "speed", "entry", "sl", "tp", "risk", "balance", "fee",
  "place", "close", "trades", "positions", "pnl", "win", "pf",
  "exp", "dd", "avgR", "csv", "save", "reset"
];

assert.match(html, /<!doctype html>/i, "QuantReplay must declare an HTML doctype");
assert.match(html, /<html\\s+lang=["']en["']/i, "Document language must be declared");
assert.match(html, /<meta[^>]+name=["']viewport["']/i, "Responsive viewport metadata is required");
assert.match(html, /<title>QuantReplay/i, "QuantReplay page title is missing");
assert.match(html, /lightweight-charts@4\\.2\\.3/i, "Expected pinned Lightweight Charts CDN dependency");
assert.match(html, /data-api\\.binance\\.vision\\/api\\/v3\\/klines/i, "Public Binance candle endpoint is missing");
assert.match(html, /localStorage/i, "Browser-local session persistence is expected");
assert.match(html, /stop-loss is assumed first|stop.*first/i, "Intrabar stop-first policy must be documented");
assert.match(html, /SIMULATION ONLY|No live orders/i, "Simulation-only boundary must be visible");

for (const id of requiredIds) {
  assert.ok(
    new RegExp('id=["\\\\']' + id + '["\\\\']').test(html),
    `Required UI element is missing: #${id}`
  );
}

const inlineScripts = [...html.matchAll(/<script\\b(?![^>]*\\bsrc=)[^>]*>([\\s\\S]*?)<\\/script>/gi)];
assert.equal(inlineScripts.length, 1, "Expected exactly one inline application script");
assert.ok(inlineScripts[0][1].trim().length > 0, "Inline application script is empty");

// Compile without executing browser-dependent code. This catches syntax errors
// while keeping CI independent of a browser or external market-data service.
new Script(inlineScripts[0][1], { filename: "quantreplay/index.html:inline-script" });

assert.ok(
  !/(?:api[_-]?key|client[_-]?secret)\\s*[:=]\\s*["'][^"']{12,}/i.test(html),
  "A hard-coded API credential-like value was detected"
);

console.log(`QuantReplay static QA passed: ${requiredIds.length} required UI IDs and inline JavaScript syntax checked.`);
