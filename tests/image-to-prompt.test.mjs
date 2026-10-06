import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  ApiError, MAX_IMAGE_BYTES, UsageError, closestCommonAspectRatio, imageToPrompt,
  inspectImage, parseModelContent, requestCompletion,
} from "../scripts/lib/image-to-prompt.mjs";

const fixture = fileURLToPath(new URL("./fixtures/pixel.png", import.meta.url));
const script = fileURLToPath(new URL("../scripts/image-to-prompt.mjs", import.meta.url));
const example = JSON.parse(await readFile(new URL("../examples/product-still-life.gpt_image.en.json", import.meta.url), "utf8"));

function jpeg(width, height, orientation) {
  const parts = [Buffer.from([0xff, 0xd8])];
  if (orientation) {
    const tiff = Buffer.alloc(26);
    tiff.write("MM", 0, "ascii"); tiff.writeUInt16BE(42, 2); tiff.writeUInt32BE(8, 4);
    tiff.writeUInt16BE(1, 8); tiff.writeUInt16BE(0x0112, 10); tiff.writeUInt16BE(3, 12);
    tiff.writeUInt32BE(1, 14); tiff.writeUInt16BE(orientation, 18);
    const body = Buffer.concat([Buffer.from("Exif\0\0", "ascii"), tiff]);
    const len = Buffer.alloc(2); len.writeUInt16BE(body.length + 2);
    parts.push(Buffer.from([0xff, 0xe1]), len, body);
  }
  const sof = Buffer.from([0xff, 0xc0, 0, 17, 8, 0, 0, 0, 0, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
  sof.writeUInt16BE(height, 5); sof.writeUInt16BE(width, 7);
  parts.push(sof, Buffer.from([0xff, 0xd9]));
  return Buffer.concat(parts);
}

function webpVp8x(width, height) {
  const b = Buffer.alloc(30);
  b.write("RIFF", 0, "ascii"); b.writeUInt32LE(22, 4); b.write("WEBP", 8, "ascii"); b.write("VP8X", 12, "ascii");
  b.writeUIntLE(width - 1, 24, 3); b.writeUIntLE(height - 1, 27, 3);
  return b;
}

function webpVp8l(width, height) {
  const b = Buffer.alloc(25);
  b.write("RIFF", 0, "ascii"); b.write("WEBP", 8, "ascii"); b.write("VP8L", 12, "ascii"); b[20] = 0x2f;
  b.writeUInt32LE(((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14), 21);
  return b;
}

test("reads dimensions and type from magic bytes", async () => {
  assert.deepEqual(inspectImage(await readFile(fixture)), { mime: "image/png", width: 3, height: 2, bytes: 73 });
  assert.deepEqual(inspectImage(jpeg(1200, 900)), { mime: "image/jpeg", width: 1200, height: 900, bytes: jpeg(1200, 900).length });
  assert.equal(inspectImage(webpVp8x(800, 1200)).height, 1200);
  assert.equal(inspectImage(webpVp8l(640, 480)).width, 640);
});

test("EXIF orientation 6 swaps JPEG width and height", () => {
  const info = inspectImage(jpeg(1200, 900, 6));
  assert.equal(info.width, 900);
  assert.equal(info.height, 1200);
  assert.equal(inspectImage(jpeg(1200, 900, 1)).width, 1200);
});

test("rejects unsupported content and files over 4 MB regardless of extension", () => {
  assert.throws(() => inspectImage(Buffer.from("GIF89a....")), UsageError);
  assert.throws(() => inspectImage(Buffer.alloc(0)), UsageError);
  const big = Buffer.alloc(MAX_IMAGE_BYTES + 1); jpeg(10, 10).copy(big);
  assert.throws(() => inspectImage(big), /limit is 4 MB/);
});

test("closest common aspect ratio", () => {
  assert.equal(closestCommonAspectRatio(1200, 900), "4:3");
  assert.equal(closestCommonAspectRatio(848, 1200), "2:3");
  assert.equal(closestCommonAspectRatio(1920, 1080), "16:9");
  assert.equal(closestCommonAspectRatio(1000, 1000), "1:1");
});

test("output validation: accepts the shipped example, rejects drift", () => {
  assert.equal(parseModelContent(JSON.stringify(example)).title, example.title);
  assert.equal(parseModelContent("```json\n" + JSON.stringify(example) + "\n```").version, 1);
  const missing = { ...example }; delete missing.camera;
  assert.throws(() => parseModelContent(JSON.stringify(missing)), /missing camera/);
  assert.throws(() => parseModelContent(JSON.stringify({ ...example, extra: 1 })), /unexpected key extra/);
  assert.throws(() => parseModelContent(JSON.stringify({ ...example, subject: "x" })), /subject/);
  assert.throws(() => parseModelContent(""), /empty content/);
  assert.throws(() => parseModelContent("not json"), /valid JSON/);
  assert.throws(() => parseModelContent('{"refusal":"no"}'), (e) => e.code === "CONTENT_NOT_ALLOWED");
});

const ok = (content) => new Response(JSON.stringify({ model: "deepseek-v4.1-flash", choices: [{ message: { content } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }));

test("live request shape: endpoint, auth header, json_object, measured ratio", async () => {
  let seen;
  const fetchImpl = async (url, init) => { seen = { url, init }; return ok(JSON.stringify({ ...example, suggestedAspectRatio: "9:16" })); };
  const out = await imageToPrompt({ source: fixture, mode: "midjourney", language: "zh", apiKey: "sk-test", baseUrl: "https://mock.local/", fetchImpl });
  assert.equal(seen.url, "https://mock.local/v1/chat/completions");
  assert.equal(seen.init.headers.Authorization, "Bearer sk-test");
  const body = JSON.parse(seen.init.body);
  assert.equal(body.model, "deepseek-v4.1-flash");
  assert.equal(body.max_tokens, 8000);
  assert.deepEqual(body.response_format, { type: "json_object" });
  assert.ok(body.messages[0].content.startsWith("# Role"));
  assert.match(body.messages[1].content[0].text, /Simplified Chinese[\s\S]*3x2[\s\S]*--ar 3:2/);
  assert.match(body.messages[1].content[1].image_url.url, /^data:image\/png;base64,/);
  assert.equal(out.result.suggestedAspectRatio, "3:2");
});

test("missing key fails before any network call", async () => {
  let calls = 0;
  await assert.rejects(imageToPrompt({ source: fixture, apiKey: "", fetchImpl: async () => { calls += 1; } }), /HIAPI_API_KEY is not set/);
  assert.equal(calls, 0);
});

test("retries once on a pre-response network error, never after an HTTP status or timeout", async () => {
  const payload = { model: "m", messages: [] };
  let calls = 0;
  const flaky = async () => { calls += 1; if (calls === 1) throw new TypeError("fetch failed"); return ok(JSON.stringify(example)); };
  assert.equal((await requestCompletion(payload, { apiKey: "k", fetchImpl: flaky })).result.version, 1);
  assert.equal(calls, 2);

  calls = 0;
  const down = async () => { calls += 1; throw new TypeError("fetch failed"); };
  await assert.rejects(requestCompletion(payload, { apiKey: "k", fetchImpl: down }), /Network error/);
  assert.equal(calls, 2);

  calls = 0;
  const http500 = async () => { calls += 1; return new Response('{"error":{"message":"boom"}}', { status: 500 }); };
  await assert.rejects(requestCompletion(payload, { apiKey: "k", fetchImpl: http500 }), (e) => e instanceof ApiError && e.status === 500);
  assert.equal(calls, 1);

  calls = 0;
  const slow = async () => { calls += 1; throw Object.assign(new Error("timeout"), { name: "TimeoutError" }); };
  await assert.rejects(requestCompletion(payload, { apiKey: "k", fetchImpl: slow }), /Not retried/);
  assert.equal(calls, 1);
});

test("HTTP errors carry actionable hints without echoing the key", async () => {
  for (const [status, pattern] of [[401, /api-keys/], [402, /balance/], [429, /Rate limited/]]) {
    await assert.rejects(
      requestCompletion({ model: "m" }, { apiKey: "sk-secret-123", fetchImpl: async () => new Response("{}", { status }) }),
      (e) => pattern.test(e.message) && !e.message.includes("sk-secret-123"),
    );
  }
});

test("--dry-run prints a redacted payload and never the key", () => {
  const r = spawnSync(process.execPath, [script, fixture, "--mode", "gpt_image", "--dry-run"], {
    encoding: "utf8", env: { ...process.env, HIAPI_API_KEY: "sk-secret-should-not-print", HIAPI_BASE_URL: "http://127.0.0.1:9" },
  });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!r.stdout.includes("sk-secret-should-not-print"));
  const out = JSON.parse(r.stdout);
  assert.equal(out.networkCall, false);
  assert.match(out.payload.messages[0].content, /chars from references\/system-prompt.md/);
  assert.match(out.payload.messages[1].content[1].image_url.url, /base64,<\d+ chars>$/);
  assert.equal(out.image.suggestedAspectRatio, "3:2");
});

test("CLI rejects bad options with exit code 2", () => {
  for (const args of [[fixture, "--mode", "dalle"], [fixture, "--language", "fr"], [], ["http://example.com/a.png", "--dry-run"]]) {
    const r = spawnSync(process.execPath, [script, ...args], { encoding: "utf8", env: { ...process.env, HIAPI_SKIP_UPDATE_CHECK: "1", HIAPI_API_KEY: "" } });
    assert.equal(r.status, 2, `${args.join(" ")}: ${r.stderr}`);
  }
});
