import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { DEFAULT_SITE_URL, SKILL_ID, SKILL_VERSION, UPDATE_COMMAND, checkSkillUpdate, compareVersions } from "../scripts/lib/image-to-prompt.mjs";

const readJson = async (p) => JSON.parse(await readFile(new URL(`../${p}`, import.meta.url), "utf8"));
const policy = await readJson("update-policy.json");
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
const env = {};

test("versions and ids agree across package, runtime, policy, and release manifest", async () => {
  const pkg = await readJson("package.json");
  const release = await readJson(".hiapi-skill-release.json");
  for (const v of [pkg.version, release.version, policy.version, policy.updatePolicy.latestVersion]) assert.equal(v, SKILL_VERSION);
  assert.equal(policy.id, SKILL_ID);
  assert.equal(release.skillId, SKILL_ID);
  assert.equal(policy.updatePolicy.updateCommand, UPDATE_COMMAND);
  assert.match((await readFile(new URL("../SKILL.md", import.meta.url), "utf8")), new RegExp(`^name: ${SKILL_ID}$`, "m"));
});

test("compareVersions", () => {
  assert.equal(compareVersions("0.1.0", "0.1.1"), -1);
  assert.equal(compareVersions("0.2.0", "0.1.9"), 1);
  assert.equal(compareVersions("1.0.0-beta", "1.0.0"), 0);
});

test("soft and hard upgrade semantics", async () => {
  const central = (latest, minimum) => async () => json({ skills: [{ id: SKILL_ID, updatePolicy: { ...policy.updatePolicy, latestVersion: latest, minimumVersion: minimum } }] });
  assert.equal((await checkSkillUpdate({ currentVersion: "0.1.0", fetchImpl: central("0.1.0", "0.1.0"), env })).status, "current");
  assert.equal((await checkSkillUpdate({ currentVersion: "0.1.0", fetchImpl: central("0.2.0", "0.1.0"), env })).status, "available");
  const hard = await checkSkillUpdate({ currentVersion: "0.1.0", fetchImpl: central("0.2.0", "0.2.0"), env });
  assert.equal(hard.status, "required");
  assert.match(hard.message, /hiapi-image-to-prompt-install/);
});

test("central first, repository fallback, outage is unverified not blocking", async () => {
  let calls = 0;
  const fallback = async () => { calls += 1; return calls === 1 ? json({}, 503) : json({ ...policy, updatePolicy: { latestVersion: "9.0.0", minimumVersion: "0.0.1" } }); };
  assert.equal((await checkSkillUpdate({ fetchImpl: fallback, env })).status, "available");
  assert.equal(calls, 2);
  assert.equal((await checkSkillUpdate({ fetchImpl: async () => { throw new Error("offline"); }, env })).status, "unverified");
  assert.equal((await checkSkillUpdate({ env: { HIAPI_SKIP_UPDATE_CHECK: "1" } })).status, "skipped");
});

test("public no-key endpoints use the api host", () => {
  assert.equal(DEFAULT_SITE_URL, "https://api.hiapi.ai");
  assert.ok(`${DEFAULT_SITE_URL}/api/models/content`.startsWith("https://api.hiapi.ai/api/"));
});
