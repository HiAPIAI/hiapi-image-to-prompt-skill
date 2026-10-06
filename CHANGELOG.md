# Changelog

## 0.1.0 — 2026-10-06

- First local release candidate.
- Method v7 system prompt (two-pass inventory → prompt; positions, silhouettes, dominant compositional shape, cast-light shapes, counts, verbatim text with layout; white balance and brightness from measured color data when given; time-of-day and mood words only when the image supports them; Midjourney/FLUX/SD prompts always in English), shared by the Agent path and the script.
- Five prompt modes (`general`, `gpt_image`, `midjourney`, `flux`, `stable_diffusion`) in English and Chinese, identical to the HiAPI web tool.
- Optional `scripts/image-to-prompt.mjs`: HiAPI chat/completions with `deepseek-v4.1-flash`, `json_object`, local key validation, magic-byte image checks (≤ 4 MB), `--dry-run`, one network-only retry.
- Regenerate-and-compare workflow through the `hiapi-gpt-image-2-5` companion skill; evaluation notes and sources.
