# Upgrade policy

The skill reads the `hiapi-image-to-prompt` entry in the central [hiapi-skills](https://github.com/HiAPIAI/hiapi-skills) `skills.json` first and this repository's [update-policy.json](../update-policy.json) second.

- Below `latestVersion`, at or above `minimumVersion`: **soft upgrade** — print a notice and continue.
- Below `minimumVersion`: **hard upgrade** — `scripts/image-to-prompt.mjs` refuses live (billable) calls and prints the update command. `--dry-run`, `check-config.mjs`, and the Agent-vision path keep working.
- Both sources unreachable: status `unverified`; continue. An update-service outage never blocks the skill.

`scripts/check-update.mjs` runs the same check for the Agent path once per session and exits 1 only on a hard upgrade.

Release order: publish the new skill version first, then raise `latestVersion` / `minimumVersion` in the central entry and in `update-policy.json` together. Package, runtime (`SKILL_VERSION`), `.hiapi-skill-release.json`, and policy versions must agree; `npm test` checks this.
