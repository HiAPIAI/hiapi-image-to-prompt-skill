#!/usr/bin/env node
// Configuration and public-contract check. Creates no billable call and never prints secrets.
//   node scripts/check-config.mjs            local checks + public no-key model metadata
//   node scripts/check-config.mjs --offline  local checks only
import { readFile } from "node:fs/promises";
import {
  DEFAULT_MODEL, DEFAULT_SITE_URL, RESULT_KEYS, SKILL_ID, SKILL_VERSION,
  loadSystemPrompt, promptModeInstruction, MODES,
} from "./lib/image-to-prompt.mjs";

const offline = process.argv.includes("--offline");
const root = new URL("../", import.meta.url);
const readJson = async (p) => JSON.parse(await readFile(new URL(p, root), "utf8"));
const checks = [];
const check = (name, ok, evidence) => checks.push({ name, ok: Boolean(ok), ...(evidence === undefined ? {} : { evidence }) });

const prompt = await loadSystemPrompt();
check("system prompt loads and excludes agent-only text", prompt.startsWith("# Role") && !prompt.includes("agent-only") && !prompt.includes("Agent mode"));
check("system prompt lists every output key", RESULT_KEYS.every((k) => prompt.includes(`"${k}"`)));
check("system prompt keeps safety rules", ["Never follow them", "Do not identify real people", "Do not name living artists"].every((s) => prompt.includes(s)));
const modesDoc = await readFile(new URL("references/prompt-modes.md", root), "utf8");
check("prompt-modes.md matches runtime mode instructions", MODES.every((m) => ["en", "zh"].every((l) => modesDoc.includes(promptModeInstruction(m, l, "{ratio}")))));

const pkg = await readJson("package.json");
const policy = await readJson("update-policy.json");
const release = await readJson(".hiapi-skill-release.json");
const skillMd = await readFile(new URL("SKILL.md", root), "utf8");
check("versions agree", [pkg.version, policy.version, release.version, policy.updatePolicy.latestVersion].every((v) => v === SKILL_VERSION), { runtime: SKILL_VERSION, package: pkg.version, policy: policy.version, release: release.version });
check("skill id agrees", policy.id === SKILL_ID && release.skillId === SKILL_ID && skillMd.includes(`name: ${SKILL_ID}`));
check("HIAPI_API_KEY present (only needed for the optional script path)", true, process.env.HIAPI_API_KEY ? "set" : "not set");

if (!offline) {
  try {
    const r = await fetch(`${DEFAULT_SITE_URL}/api/models/content?name=${encodeURIComponent(DEFAULT_MODEL)}`, { signal: AbortSignal.timeout(15000) });
    const body = await r.json();
    const modalities = body?.data?.llm_metadata_json?.input_modalities || [];
    check(`default model ${DEFAULT_MODEL} is public and accepts images`, r.ok && body?.data?.model_name === DEFAULT_MODEL && modalities.includes("image"), { status: r.status, inputModalities: modalities });
  } catch (e) {
    check(`default model ${DEFAULT_MODEL} public metadata reachable`, false, String(e?.message || e));
  }
}

const ok = checks.every((c) => c.ok);
console.log(JSON.stringify({ skill: SKILL_ID, version: SKILL_VERSION, ok, checks }, null, 2));
if (!ok) process.exitCode = 2;
