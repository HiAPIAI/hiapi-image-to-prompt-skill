#!/usr/bin/env node
// Once-per-session update check for the Agent path. Skips silently when offline.
// Set HIAPI_SKIP_UPDATE_CHECK=1 to disable.
import { SKILL_ID, SKILL_VERSION, checkSkillUpdate } from "./lib/image-to-prompt.mjs";

const result = await checkSkillUpdate();
if (result.message) console.error(result.message);
console.log(JSON.stringify({ skill: SKILL_ID, version: SKILL_VERSION, updateStatus: result.status }));
if (result.status === "required") process.exitCode = 1;
