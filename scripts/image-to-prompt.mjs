#!/usr/bin/env node
// Turn one reference image into a regeneration prompt through HiAPI chat/completions.
// The API key is read only from the HIAPI_API_KEY environment variable and is never printed.
import { parseArgs } from "node:util";
import {
  ApiError, DEFAULT_BASE_URL, DEFAULT_MODEL, MODES, SKILL_VERSION, UsageError,
  buildPayload, checkSkillUpdate, closestCommonAspectRatio, formatResult, imageToPrompt,
  inspectImage, isHttpsUrl, loadSystemPrompt, readImageSource, redactPayload, validateOptions,
} from "./lib/image-to-prompt.mjs";

const HELP = `Usage: node scripts/image-to-prompt.mjs <image-path-or-https-url> [options]

Options:
  --mode <mode>        ${MODES.join(" | ")} (default general)
  --language <lang>    en | zh (default en)
  --model <id>         HiAPI vision chat model (default ${DEFAULT_MODEL})
  --json               print the validated JSON object only
  --dry-run            print the redacted request payload; no network call, no cost
  --help               show this help

Input: JPEG, PNG, or WebP up to 4 MB (checked by file content). No resizing is done.
Env:   HIAPI_API_KEY (required for live calls), HIAPI_BASE_URL (optional, default ${DEFAULT_BASE_URL}).
Cost:  each live call spends a small per-call token cost on your HiAPI balance.`;

async function main() {
  let parsed;
  try {
    parsed = parseArgs({
      allowPositionals: true,
      options: {
        mode: { type: "string", default: "general" },
        language: { type: "string", default: "en" },
        model: { type: "string", default: DEFAULT_MODEL },
        json: { type: "boolean", default: false },
        "dry-run": { type: "boolean", default: false },
        help: { type: "boolean", short: "h", default: false },
      },
    });
  } catch (e) {
    throw new UsageError(e.message);
  }
  const { values, positionals } = parsed;
  if (values.help) return console.log(HELP);
  if (positionals.length !== 1) throw new UsageError(`Pass exactly one image path or https URL.\n\n${HELP}`);
  const source = positionals[0];
  const opts = validateOptions(values);

  if (values["dry-run"]) {
    const systemPrompt = await loadSystemPrompt();
    const isUrl = /^[a-z]+:\/\//i.test(source);
    if (isUrl && !isHttpsUrl(source)) throw new UsageError("Only https:// image URLs are accepted.");
    let image = { mime: "image/jpeg", width: 0, height: 0, bytes: 0 };
    let dataUrl = "data:image/jpeg;base64,<downloaded from the URL at run time>";
    if (!isUrl) {
      const bytes = await readImageSource(source);
      image = inspectImage(bytes);
      dataUrl = `data:${image.mime};base64,${bytes.toString("base64")}`;
    }
    const payload = buildPayload({ systemPrompt, image, dataUrl, ...opts });
    console.log(JSON.stringify({
      dryRun: true,
      networkCall: false,
      endpoint: `POST ${(process.env.HIAPI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "")}/v1/chat/completions`,
      authorization: process.env.HIAPI_API_KEY ? "Bearer <HIAPI_API_KEY set, redacted>" : "Bearer <HIAPI_API_KEY not set>",
      image: isUrl ? { source: "https URL (downloaded, validated, and measured at run time)" } : { ...image, suggestedAspectRatio: closestCommonAspectRatio(image.width, image.height) },
      payload: redactPayload(payload),
    }, null, 2));
    return;
  }

  const update = await checkSkillUpdate();
  if (update.status === "required") throw new UsageError(`${update.message}\n(--dry-run still works.)`);
  if (update.message) console.error(update.message);

  const out = await imageToPrompt({ source, ...opts, apiKey: process.env.HIAPI_API_KEY, baseUrl: process.env.HIAPI_BASE_URL || DEFAULT_BASE_URL });
  if (out.usage) console.error(`[hiapi-image-to-prompt ${SKILL_VERSION}] model ${out.model}; tokens in ${out.usage.prompt_tokens ?? "?"} / out ${out.usage.completion_tokens ?? "?"}`);
  console.log(values.json ? JSON.stringify(out.result, null, 2) : formatResult(out.result, opts.language));
}

main().catch((e) => {
  if (e instanceof UsageError) { console.error(e.message); process.exitCode = 2; return; }
  if (e instanceof ApiError) { console.error(e.message); process.exitCode = 1; return; }
  console.error(`Unexpected error: ${e?.message || e}`);
  process.exitCode = 1;
});
