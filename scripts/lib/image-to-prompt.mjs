// Shared runtime for the HiAPI Image to Prompt skill. No dependencies.
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export const SKILL_ID = "hiapi-image-to-prompt";
export const SKILL_VERSION = "0.1.1";
export const DEFAULT_BASE_URL = "https://api.hiapi.ai";
export const DEFAULT_SITE_URL = "https://api.hiapi.ai";
export const DEFAULT_MODEL = "deepseek-v4.1-flash";
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_TOKENS = 8000;
export const REQUEST_TIMEOUT_MS = 120_000;
export const DOWNLOAD_TIMEOUT_MS = 30_000;
export const MODES = ["general", "gpt_image", "midjourney", "flux", "stable_diffusion"];
export const LANGUAGES = ["en", "zh"];
export const RESULT_KEYS = [
  "version", "title", "summary", "mainPrompt", "negativePrompt", "subject", "composition",
  "lighting", "colorPalette", "camera", "style", "qualityDetails", "suggestedAspectRatio",
];
export const ARRAY_KEYS = ["subject", "composition", "lighting", "colorPalette", "camera", "style", "qualityDetails"];
export const DEFAULT_SKILLS_MANIFEST_URL = "https://raw.githubusercontent.com/HiAPIAI/hiapi-skills/main/skills.json";
export const DEFAULT_REPOSITORY_POLICY_URL = "https://raw.githubusercontent.com/HiAPIAI/hiapi-image-to-prompt-skill/main/update-policy.json";
export const UPDATE_COMMAND = 'npx --yes --package=github:HiAPIAI/hiapi-image-to-prompt-skill hiapi-image-to-prompt-install --target="${AGENT_SKILLS_DIR:-$HOME/.codex/skills}" --force';

export const SYSTEM_PROMPT_PATH = fileURLToPath(new URL("../../references/system-prompt.md", import.meta.url));

/** The API system message: the reference file minus HTML comments and the agent-only block. */
export function apiSystemPrompt(markdown) {
  return markdown
    .replace(/<!-- agent-only:start -->[\s\S]*?<!-- agent-only:end -->/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();
}

export async function loadSystemPrompt(path = SYSTEM_PROMPT_PATH) {
  return apiSystemPrompt(await readFile(path, "utf8"));
}

// Mirrors references/prompt-modes.md (kept identical to the HiAPI web tool).
export function promptModeInstruction(mode, language, aspectRatio) {
  const zh = language === "zh";
  switch (mode) {
    case "midjourney":
      return zh
        ? `Midjourney 模式：mainPrompt 使用连贯的 Midjourney 自然语言描述，并在末尾追加一次 --ar ${aspectRatio}。不要添加模型版本、风格化数值或不可见参数。`
        : `Midjourney mode: write mainPrompt as coherent Midjourney-ready natural language and append --ar ${aspectRatio} exactly once. Do not add model versions, stylize values, or invisible parameters.`;
    case "flux":
      return zh
        ? "FLUX 模式：mainPrompt 使用简洁、连贯的自然语言描述，优先保留主体、材质、空间、光线和风格，不添加平台命令或参数。"
        : "FLUX mode: write mainPrompt as concise, coherent natural language. Prioritize subject, material, space, lighting, and style. Do not add platform commands or parameters.";
    case "stable_diffusion":
      return zh
        ? "Stable Diffusion 模式：mainPrompt 使用清晰的逗号分隔正向标签；negativePrompt 使用逗号分隔的负向标签。不要添加采样器、种子或权重。"
        : "Stable Diffusion mode: write mainPrompt as clear comma-separated positive tags and negativePrompt as comma-separated negative tags. Do not add samplers, seeds, or weights.";
    case "gpt_image":
      return zh
        ? "GPT Image 模式：mainPrompt 使用清晰、自然的完整语句，按场景、主体、构图、光线、材质、风格的顺序描述；对可见文字使用引号保留原文，不添加 Midjourney 或 Stable Diffusion 参数。"
        : "GPT Image mode: write mainPrompt as clear, complete natural language in scene, subject, composition, lighting, material, and style order. Preserve visible text in quotation marks. Do not add Midjourney or Stable Diffusion parameters.";
    default:
      return zh
        ? "通用描述模式：mainPrompt 写成一条详细、模型中立、可复制的自然语言图片生成提示词。"
        : "General mode: write mainPrompt as one detailed, model-neutral, copy-ready natural-language image-generation prompt.";
  }
}

const COMMON_RATIOS = [["1:1", 1], ["4:3", 4 / 3], ["3:2", 3 / 2], ["16:9", 16 / 9], ["3:4", 3 / 4], ["2:3", 2 / 3], ["9:16", 9 / 16]];

export function closestCommonAspectRatio(width, height) {
  if (!(width > 0 && height > 0)) return "1:1";
  const source = width / height;
  return COMMON_RATIOS.reduce((best, c) =>
    Math.abs(Math.log(c[1] / source)) < Math.abs(Math.log(best[1] / source)) ? c : best)[0];
}

const ALWAYS_ENGLISH = new Set(["midjourney", "flux", "stable_diffusion"]);
const ENGLISH_PROMPT_RULE = " Write mainPrompt and negativePrompt in English even when the output language is Chinese, because this model reads English prompts best; keep the other fields in the output language.";

export function buildUserText({ mode, language, width, height }) {
  const ratio = closestCommonAspectRatio(width, height);
  return `Analyze this reference image.
Output language: ${language === "zh" ? "Simplified Chinese" : "English"}.
Source dimensions: ${width}x${height}.
Closest common aspect ratio: ${ratio}.
Orientation: ${width > height ? "landscape (wider than tall)" : width < height ? "portrait (taller than wide)" : "square"}. State this orientation correctly.
Output adaptation: ${promptModeInstruction(mode, language, ratio)}${ALWAYS_ENGLISH.has(mode) && language === "zh" ? ENGLISH_PROMPT_RULE : ""}
Return only the JSON object.`;
}

// ---------- image inspection (magic bytes + header dimensions, no native deps) ----------

export function sniffImage(bytes) {
  const b = bytes;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b.toString("hex", 0, 8) === "89504e470d0a1a0a") return "image/png";
  if (b.length >= 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

function jpegOrientation(b, start, end) {
  // APP1 "Exif\0\0" + TIFF header; returns EXIF orientation or 1.
  if (b.toString("ascii", start, start + 6) !== "Exif\0\0") return 1;
  const t = start + 6;
  const le = b.toString("ascii", t, t + 2) === "II";
  const u16 = (o) => (le ? b.readUInt16LE(o) : b.readUInt16BE(o));
  const u32 = (o) => (le ? b.readUInt32LE(o) : b.readUInt32BE(o));
  const ifd = t + u32(t + 4);
  if (ifd + 2 > end) return 1;
  const count = u16(ifd);
  for (let i = 0; i < count; i += 1) {
    const e = ifd + 2 + i * 12;
    if (e + 12 > end) break;
    if (u16(e) === 0x0112) return u16(e + 8);
  }
  return 1;
}

export function imageDimensions(bytes, mime = sniffImage(bytes)) {
  const b = bytes;
  try {
    if (mime === "image/png") return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
    if (mime === "image/webp") {
      const chunk = b.toString("ascii", 12, 16);
      if (chunk === "VP8X") return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
      if (chunk === "VP8L") {
        const bits = b.readUInt32LE(21);
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
      }
      if (chunk === "VP8 ") return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
      return null;
    }
    if (mime === "image/jpeg") {
      let orientation = 1;
      let o = 2;
      while (o + 4 <= b.length) {
        if (b[o] !== 0xff) { o += 1; continue; }
        const marker = b[o + 1];
        if (marker === 0xff) { o += 1; continue; }
        if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { o += 2; continue; }
        const len = b.readUInt16BE(o + 2);
        if (marker === 0xe1) orientation = jpegOrientation(b, o + 4, Math.min(b.length, o + 2 + len));
        const isSof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
        if (isSof) {
          const height = b.readUInt16BE(o + 5);
          const width = b.readUInt16BE(o + 7);
          return orientation >= 5 && orientation <= 8 ? { width: height, height: width } : { width, height };
        }
        o += 2 + len;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function inspectImage(bytes) {
  if (!bytes?.length) throw new UsageError("The image is empty.");
  if (bytes.length > MAX_IMAGE_BYTES)
    throw new UsageError(`The image is ${(bytes.length / 1048576).toFixed(1)} MB; the limit is 4 MB. Resize or recompress it first.`);
  const mime = sniffImage(bytes);
  if (!mime) throw new UsageError("Unsupported image. Use JPEG, PNG, or WebP (checked by file content, not extension).");
  const dims = imageDimensions(bytes, mime);
  if (!dims || !(dims.width > 0 && dims.height > 0)) throw new UsageError(`Could not read the ${mime} dimensions; the file may be corrupt.`);
  return { mime, ...dims, bytes: bytes.length };
}

export class UsageError extends Error {}
export class ApiError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function isHttpsUrl(value) {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}

export async function readImageSource(source, { fetchImpl = fetch } = {}) {
  if (/^[a-z]+:\/\//i.test(source)) {
    if (!isHttpsUrl(source)) throw new UsageError("Only https:// image URLs are accepted.");
    let res;
    try {
      res = await fetchImpl(source, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS), redirect: "follow" });
    } catch (e) {
      throw new UsageError(`Could not download the image URL: ${e?.message || e}`);
    }
    if (!res.ok) throw new UsageError(`Downloading the image URL returned HTTP ${res.status}.`);
    const declared = Number(res.headers?.get?.("content-length") || 0);
    if (declared > MAX_IMAGE_BYTES) throw new UsageError("The image URL is larger than 4 MB.");
    return Buffer.from(await res.arrayBuffer());
  }
  const info = await stat(source).catch(() => null);
  if (!info?.isFile()) throw new UsageError(`Image file not found: ${source}`);
  if (info.size > MAX_IMAGE_BYTES) throw new UsageError(`The image is ${(info.size / 1048576).toFixed(1)} MB; the limit is 4 MB.`);
  return readFile(source);
}

// ---------- request ----------

export function validateOptions({ mode = "general", language = "en", model = DEFAULT_MODEL } = {}) {
  if (!MODES.includes(mode)) throw new UsageError(`--mode must be one of: ${MODES.join(", ")}`);
  if (!LANGUAGES.includes(language)) throw new UsageError("--language must be zh or en");
  if (typeof model !== "string" || !/^[A-Za-z0-9._:@/-]{1,120}$/.test(model)) throw new UsageError("--model is not a valid model ID");
  return { mode, language, model };
}

export function buildPayload({ systemPrompt, image, dataUrl, mode, language, model }) {
  return {
    model,
    max_tokens: MAX_TOKENS,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: buildUserText({ mode, language, width: image.width, height: image.height }) },
          { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
        ],
      },
    ],
  };
}

export function redactPayload(payload) {
  const copy = structuredClone(payload);
  for (const m of copy.messages) {
    if (m.role === "system") m.content = `<${m.content.length} chars from references/system-prompt.md>`;
    if (Array.isArray(m.content))
      for (const part of m.content)
        if (part.type === "image_url") part.image_url.url = part.image_url.url.replace(/base64,.*/s, (s) => `base64,<${s.length - 7} chars>`);
  }
  return copy;
}

// ---------- response ----------

export function validateResult(raw) {
  const problems = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, problems: ["not a JSON object"] };
  for (const key of RESULT_KEYS) if (!(key in raw)) problems.push(`missing ${key}`);
  for (const key of Object.keys(raw)) if (!RESULT_KEYS.includes(key)) problems.push(`unexpected key ${key}`);
  if (raw.version !== 1) problems.push("version must be 1");
  for (const key of ["title", "summary", "mainPrompt", "suggestedAspectRatio"])
    if (typeof raw[key] !== "string" || !raw[key].trim()) problems.push(`${key} must be a non-empty string`);
  if (typeof raw.negativePrompt !== "string") problems.push("negativePrompt must be a string");
  if (typeof raw.mainPrompt === "string" && (raw.mainPrompt.length < 20 || raw.mainPrompt.length > 8000))
    problems.push("mainPrompt length must be 20-8000 characters");
  for (const key of ARRAY_KEYS) {
    const v = raw[key];
    if (!Array.isArray(v) || v.length > 20 || v.some((x) => typeof x !== "string" || !x.trim() || x.length > 240))
      problems.push(`${key} must be an array of up to 20 short strings`);
  }
  return { ok: problems.length === 0, problems };
}

export function parseModelContent(content) {
  const text = String(content ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  if (!text) throw new ApiError("The model returned empty content (it may have hit the token limit). Try again or use another --model.", { code: "OUTPUT_INVALID" });
  let raw;
  try { raw = JSON.parse(text); } catch {
    throw new ApiError("The model did not return valid JSON. Try again or use another --model.", { code: "OUTPUT_INVALID" });
  }
  if (raw && typeof raw === "object" && "refusal" in raw)
    throw new ApiError("The model declined to describe this image.", { code: "CONTENT_NOT_ALLOWED" });
  const check = validateResult(raw);
  if (!check.ok) throw new ApiError(`The model output failed validation: ${check.problems.slice(0, 5).join("; ")}`, { code: "OUTPUT_INVALID" });
  return raw;
}

function httpErrorMessage(status, body) {
  const detail = String(body?.error?.message || body?.message || "").slice(0, 300);
  const hints = {
    400: "HiAPI rejected the request",
    401: "HIAPI_API_KEY is missing or invalid. Create a key at https://www.hiapi.ai/en/dashboard/api-keys?utm_source=skill&utm_medium=agent&utm_campaign=hiapi-image-to-prompt",
    402: "Insufficient HiAPI balance. Top up at https://www.hiapi.ai/en/pricing?utm_source=skill&utm_medium=agent&utm_campaign=hiapi-image-to-prompt",
    403: "This key is not allowed to use the model",
    404: "Model not found; check --model",
    429: "Rate limited; wait and try again",
  };
  const hint = hints[status] || (status >= 500 ? "HiAPI or the upstream model failed; try again later" : "Request failed");
  return `HTTP ${status}: ${hint}${detail ? ` (${detail})` : ""}`;
}

/**
 * Posts once. Retries exactly once only when the request failed before any
 * HTTP status arrived (DNS, connection reset). Timeouts and HTTP errors are
 * never retried, so a slow-but-accepted call is not billed twice.
 */
export async function requestCompletion(payload, { apiKey, baseUrl = DEFAULT_BASE_URL, fetchImpl = fetch, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  if (!apiKey) throw new UsageError("HIAPI_API_KEY is not set. Create a key at https://www.hiapi.ai/en/dashboard/api-keys?utm_source=skill&utm_medium=agent&utm_campaign=hiapi-image-to-prompt and export it; or skip the script and let your Agent describe the image itself.");
  const url = `${baseUrl.replace(/\/+$/, "")}/v1/chat/completions`;
  const init = () => ({
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });
  let res;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      res = await fetchImpl(url, init());
      break;
    } catch (e) {
      const timedOut = e?.name === "TimeoutError" || e?.name === "AbortError";
      if (timedOut) throw new ApiError(`No response within ${Math.round(timeoutMs / 1000)} s. Not retried, to avoid a duplicate charge.`, { code: "UPSTREAM_TIMEOUT" });
      if (attempt === 1) throw new ApiError(`Network error: ${e?.message || e}`, { code: "NETWORK" });
    }
  }
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch {}
  if (!res.ok) throw new ApiError(httpErrorMessage(res.status, body), { status: res.status });
  const message = body?.choices?.[0]?.message;
  if (message?.refusal) throw new ApiError("The model declined to describe this image.", { code: "CONTENT_NOT_ALLOWED" });
  return { result: parseModelContent(message?.content), usage: body?.usage || null, model: body?.model || payload.model };
}

export async function imageToPrompt({ source, mode, language, model, apiKey, baseUrl, fetchImpl = fetch, systemPrompt }) {
  const opts = validateOptions({ mode, language, model });
  const bytes = await readImageSource(source, { fetchImpl });
  const image = inspectImage(bytes);
  const payload = buildPayload({
    systemPrompt: systemPrompt ?? (await loadSystemPrompt()),
    image,
    dataUrl: `data:${image.mime};base64,${bytes.toString("base64")}`,
    ...opts,
  });
  const out = await requestCompletion(payload, { apiKey, baseUrl, fetchImpl });
  // Like the web tool, trust the measured image ratio over the model's guess.
  out.result.suggestedAspectRatio = closestCommonAspectRatio(image.width, image.height);
  return { ...out, image };
}

export function formatResult(result, language = "en") {
  const zh = language === "zh";
  const L = zh
    ? { prompt: "提示词", negative: "负面提示词", ratio: "建议比例", none: "无", subject: "主体", composition: "构图", lighting: "光线", colorPalette: "色彩", camera: "镜头", style: "风格", qualityDetails: "质感细节" }
    : { prompt: "Prompt", negative: "Negative prompt", ratio: "Suggested aspect ratio", none: "none", subject: "Subject", composition: "Composition", lighting: "Lighting", colorPalette: "Color palette", camera: "Camera", style: "Style", qualityDetails: "Quality details" };
  const lines = [`# ${result.title}`, "", result.summary, "", `## ${L.prompt}`, "", result.mainPrompt, "", `## ${L.negative}`, "", result.negativePrompt || L.none, ""];
  for (const key of ARRAY_KEYS) if (result[key].length) lines.push(`## ${L[key]}`, ...result[key].map((x) => `- ${x}`), "");
  lines.push(`${L.ratio}: ${result.suggestedAspectRatio}`);
  return lines.join("\n");
}

// ---------- update policy (central first, repository fallback, outage never blocks) ----------

export function compareVersions(left, right) {
  const parse = (v) => String(v || "0.0.0").split(/[+-]/, 1)[0].split(".").map((p) => Number.parseInt(p, 10) || 0);
  const a = parse(left);
  const b = parse(right);
  for (let i = 0; i < Math.max(a.length, b.length, 3); i += 1) {
    const d = (a[i] || 0) - (b[i] || 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

function evaluatePolicy(policy, current) {
  const min = policy.minimumVersion || current;
  const latest = policy.latestVersion || min;
  const cmd = policy.updateCommand || UPDATE_COMMAND;
  if (compareVersions(current, min) < 0)
    return { status: "required", latestVersion: latest, minimumVersion: min, message: `${policy.requiredNotice || "This skill version is outdated and must be updated."} Installed ${current}, required ${min}. Update now: ${cmd}` };
  if (compareVersions(current, latest) < 0)
    return { status: "available", latestVersion: latest, minimumVersion: min, message: `${policy.notice || "A newer skill version is available."} Installed ${current}, latest ${latest}. Update: ${cmd}` };
  return { status: "current", latestVersion: latest, minimumVersion: min };
}

export async function checkSkillUpdate({ currentVersion = SKILL_VERSION, fetchImpl = fetch, env = process.env, manifestUrls, timeoutMs = 3000 } = {}) {
  if (["1", "true"].includes(String(env.HIAPI_SKIP_UPDATE_CHECK || "").toLowerCase())) return { status: "skipped" };
  for (const url of manifestUrls || [env.HIAPI_SKILLS_MANIFEST_URL || DEFAULT_SKILLS_MANIFEST_URL, DEFAULT_REPOSITORY_POLICY_URL]) {
    try {
      const r = await fetchImpl(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) });
      if (!r.ok) continue;
      const m = await r.json();
      const entry = Array.isArray(m.skills) ? m.skills.find((x) => x?.id === SKILL_ID) : m.id === SKILL_ID ? m : null;
      if (entry?.updatePolicy) return evaluatePolicy(entry.updatePolicy, currentVersion);
    } catch {}
  }
  return { status: "unverified" };
}
