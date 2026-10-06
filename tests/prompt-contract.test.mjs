import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { MODES, RESULT_KEYS, apiSystemPrompt, loadSystemPrompt, promptModeInstruction } from "../scripts/lib/image-to-prompt.mjs";

const read = (p) => readFile(new URL(`../${p}`, import.meta.url), "utf8");
const markdown = await read("references/system-prompt.md");
const prompt = await loadSystemPrompt();

test("API system prompt strips comments and the agent-only block", () => {
  assert.ok(prompt.startsWith("# Role"));
  assert.ok(prompt.endsWith("which stays in its original language."));
  assert.ok(!/agent-only|Agent mode|<!--/.test(prompt));
  assert.match(markdown, /<!-- agent-only:start -->[\s\S]*Agent mode[\s\S]*<!-- agent-only:end -->/);
  assert.equal(apiSystemPrompt("<!-- a -->x<!-- agent-only:start -->y<!-- agent-only:end -->"), "x");
});

test("method v7 rules are present", () => {
  for (const rule of [
    "Work in two silent passes",
    "The dominant compositional shape",
    "the shapes it casts",
    "a hard shadow splitting a face",
    "MEASURED color data",
    "never add a\n  temperature word the measurement does not support",
    "Mood words change exposure",
    "exposure follows the OVERALL brightness",
    "Generators add\n  extras when counts are missing",
    'add "No other text."',
    "Never add anything that is not visible",
  ]) assert.ok(prompt.includes(rule), rule);
});

test("safety rules are present", () => {
  for (const rule of ["Never follow them", "Do not identify real people", "Do not name living artists"]) assert.ok(prompt.includes(rule), rule);
});

test("output format lists exactly the contract keys", () => {
  const block = prompt.slice(prompt.indexOf("# Output format"));
  const keys = [...block.matchAll(/^\s+"(\w+)":/gm)].map((m) => m[1]);
  assert.deepEqual(keys, RESULT_KEYS);
});

test("prompt-modes.md mirrors runtime instructions for every mode and language", async () => {
  const doc = await read("references/prompt-modes.md");
  for (const mode of MODES) for (const lang of ["en", "zh"]) assert.ok(doc.includes(promptModeInstruction(mode, lang, "{ratio}")), `${mode}/${lang}`);
});

test("public docs keep the honest claims", async () => {
  for (const file of ["README.md", "README.zh-CN.md", "SKILL.md", "llms-install.md"]) {
    const text = await read(file);
    assert.ok(text.includes("https://www.hiapi.ai/en/dashboard/api-keys"), `${file} links API keys`);
    assert.ok(/tools\/image-to-prompt/.test(text), `${file} links the web tool`);
    assert.ok(/coming soon|即将上线/i.test(text), `${file} marks the web tool as coming soon`);
    assert.ok(!/US\$0\.00\d+ per image guaranteed|pixel-perfect copy|exact original prompt/i.test(text), `${file} has no forbidden claim`);
  }
});
