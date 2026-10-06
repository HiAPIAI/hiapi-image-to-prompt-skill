# Workflow: describe, regenerate, compare, iterate

## 1. Describe

1. Confirm there is exactly one reference image and that the user may use it. Do not describe identities of real people.
2. Choose the mode ([prompt-modes.md](prompt-modes.md)) and output language.
3. Path A (default): apply [system-prompt.md](system-prompt.md) yourself. Path B (user's key): `node scripts/image-to-prompt.mjs <image> --mode <mode> --language <en|zh> --json`.
4. Deliver: prompt block, negative prompt, breakdown, suggested aspect ratio.

## 2. Regenerate (optional, paid, companion skill)

Recommended companion: [hiapi-gpt-image-2-5](https://github.com/HiAPIAI/hiapi-gpt-image-2-5-skill). Do not reimplement its runtime here. Use `--mode gpt_image` for the description, then in the companion skill directory:

```bash
# preflight: free, creates no task
node scripts/hiapi-gpt-image-2-5.mjs \
  --prompt "<mainPrompt>" --aspect-ratio <suggestedAspectRatio> --resolution 1K \
  --dry-run --estimate

# one paid text-to-image task with a stable idempotency key
node scripts/hiapi-gpt-image-2-5.mjs \
  --prompt "<mainPrompt>" --aspect-ratio <suggestedAspectRatio> --resolution 1K \
  --idempotency-key i2p-<short-name>-001
```

Without `--image-url` the companion selects `gpt-image-2.5-flare/text-to-image`. Follow its own rules for estimates, idempotency, recovery (`--resume-task-id`), and prompt length (≤ 8,000 characters). Confirm cost with the user before the paid step.

## 3. Compare

Put the original and the regenerated image side by side (read both files; do not open GUI windows on the user's machine). List concrete differences, most visible first:

- dominant compositional shape (S-curve, diagonal, frame-within-frame) present and on the same path?
- subject count, pose, expression, silhouette of key objects;
- placement in thirds, crop edges, negative space;
- light direction and the shapes it casts (stripes, rim, hard face shadows);
- white balance and saturation (did it drift warm or cool?);
- every text element: wording, line breaks, alignment, size;
- counts of small elements.

## 4. Iterate

Edit only the sentences of `mainPrompt` that cause the listed differences — add a position, a count, a traced path, or an explicit "no golden cast" for a neutral image; never cool down a warm one. Regenerate once more with a new idempotency key. Stop after two or three rounds: text-only regeneration plateaus at "same concept and construction, detail differences" (see [evaluation.md](evaluation.md)).

## 5. When the user needs a near-identical result

Switch to image-to-image with the reference itself, for example `gpt-image-2.5-flare/image-to-image` in the companion skill (`--image-url <public https URL or data URI>`), with `mainPrompt` as the instruction plus the change the user wants. This is the right tool for "same image, small change"; a text prompt alone is not.
