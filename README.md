# Image to Prompt Agent Skill — Turn One Image into a Prompt That Recreates It

Give your Agent one reference image; get back a prompt that makes an image model regenerate a **similar** image — same subject, layout, dominant shapes, light, color grade, and verbatim text. Output for general use, GPT Image, Midjourney, FLUX, or Stable Diffusion, in English or Chinese.

**Image to Prompt • Agent Vision or HiAPI • [HiAPI](https://www.hiapi.ai/en?utm_source=github&utm_medium=readme&utm_campaign=hiapi-image-to-prompt)**

> **No code? Try the free web tool (coming soon):** [hiapi.ai/en/tools/image-to-prompt](https://www.hiapi.ai/en/tools/image-to-prompt?utm_source=github&utm_medium=readme&utm_campaign=hiapi-image-to-prompt) — planned: no sign-up, 10 images per day. ([中文版](https://www.hiapi.ai/zh/tools/image-to-prompt?utm_source=github&utm_medium=readme&utm_campaign=hiapi-image-to-prompt))
>
> **Want it in your own pipeline?** Call HiAPI with your own key: [create an API key](https://www.hiapi.ai/en/dashboard/api-keys?utm_source=github&utm_medium=readme&utm_campaign=hiapi-image-to-prompt) and run `scripts/image-to-prompt.mjs`.

[HiAPI Docs](https://docs.hiapi.ai?utm_source=github&utm_medium=readme&utm_campaign=hiapi-image-to-prompt) · [All HiAPI Skills](https://github.com/HiAPIAI/hiapi-skills) · [GPT Image 2.5 Skill](https://github.com/HiAPIAI/hiapi-gpt-image-2-5-skill) · [Pricing](https://www.hiapi.ai/en/pricing?utm_source=github&utm_medium=readme&utm_campaign=hiapi-image-to-prompt) · [API Keys](https://www.hiapi.ai/en/dashboard/api-keys?utm_source=github&utm_medium=readme&utm_campaign=hiapi-image-to-prompt)

Languages: [English](README.md) | [简体中文](README.zh-CN.md)

---

> AI Agent? Read [llms-install.md](llms-install.md) for installation steps and the agent contract.

---

## What Is This?

A prompt-reconstruction skill for Claude Code, Codex, OpenClaw, OpenCode, and any `SKILL.md` client. It packages one tested method ([references/system-prompt.md](references/system-prompt.md)) that works two ways:

| Path | Needs | What happens |
| --- | --- | --- |
| **A. Agent vision (default)** | Nothing — no key, no network | Your Agent looks at the image itself and applies the method. |
| **B. HiAPI script (optional)** | `HIAPI_API_KEY` | `scripts/image-to-prompt.mjs` sends the same method to HiAPI `chat/completions` (`deepseek-v4.1-flash` by default) and validates the JSON. Small per-call token cost. |

The result is rebuilt from visible evidence. It is not the unknown original prompt, and text-to-image will give you a close relative, not a copy — see [What To Expect](#what-to-expect).

## What The Method Captures

Two silent passes — inventory, then prompt — tuned by regenerating test images and comparing them with the originals:

- medium, every subject with count, position in thirds, pose, gaze, expression;
- exact silhouettes of key objects ("squat rounded-trapezoid bottle", not "perfume bottle");
- the **dominant compositional shape** (S-curve, ribbon, diagonal, frame-within-frame) traced through the frame;
- light direction, hardness, and the **shapes it casts** (window stripes, rim light, hard face shadows);
- white balance as observed — never cools a warm image, blocks the warm drift on neutral ones;
- every legible word verbatim with position, line breaks, alignment, and typeface style, then "No other text.";
- counts of small elements, so the generator does not add extras.

## Install

Requires Node.js 18.3+ only for the scripts; Path A needs no runtime.

```bash
npx skills add HiAPIAI/hiapi-image-to-prompt-skill --skill hiapi-image-to-prompt
```

Or the bundled installer:

```bash
npx --yes --package=github:HiAPIAI/hiapi-image-to-prompt-skill hiapi-image-to-prompt-install --codex    # ~/.codex/skills
npx --yes --package=github:HiAPIAI/hiapi-image-to-prompt-skill hiapi-image-to-prompt-install --claude   # ~/.claude/skills
npx --yes --package=github:HiAPIAI/hiapi-image-to-prompt-skill hiapi-image-to-prompt-install --target=/your/skills/dir
```

From a local checkout: `node scripts/install.mjs --target /path/to/skills`. The installer refuses to overwrite a different skill; `--force` replaces only the same skill.

## How To Use

Talk to your Agent:

> Use `$hiapi-image-to-prompt` on `poster.png` and give me a GPT Image prompt.

> 用 `$hiapi-image-to-prompt` 把这张图反推成中文提示词，Midjourney 格式。

> Use `$hiapi-image-to-prompt` on this photo, then regenerate it with GPT Image 2.5 and compare.

Or run the optional script with your own key:

```bash
export HIAPI_API_KEY='...'          # from https://www.hiapi.ai/en/dashboard/api-keys?utm_source=github&utm_medium=readme&utm_campaign=hiapi-image-to-prompt
node scripts/image-to-prompt.mjs product.jpg --mode gpt_image --language en
node scripts/image-to-prompt.mjs https://example.com/ref.webp --mode midjourney --json
node scripts/image-to-prompt.mjs product.jpg --dry-run   # redacted payload, no network, no cost
```

| Flag | Values | Default |
| --- | --- | --- |
| `--mode` | `general`, `gpt_image`, `midjourney`, `flux`, `stable_diffusion` | `general` |
| `--language` | `en`, `zh` | `en` |
| `--model` | any HiAPI chat model with image input | `deepseek-v4.1-flash` |
| `--json` | print the validated JSON only | off |
| `--dry-run` | print the redacted payload, no call | off |

Input: one JPEG, PNG, or WebP up to 4 MB (checked by file content), local path or `https://` URL. The key is read only from the environment and never printed.

## Output

```json
{
  "version": 1,
  "title": "Amber Glass Fragrance Bottle with Olive Branch",
  "summary": "A warm-lit product still life of an amber glass perfume bottle on a porous stone block …",
  "mainPrompt": "A photograph, … product still life, warm directional sunlight. In the left-center, standing on a pale pitted stone block, is a single squat rounded-trapezoid perfume bottle …",
  "negativePrompt": "text, letters, labels on the bottle, brand logo, extra bottles, …",
  "subject": ["…"], "composition": ["…"], "lighting": ["…"], "colorPalette": ["…"],
  "camera": ["…"], "style": ["…"], "qualityDetails": ["…"],
  "suggestedAspectRatio": "4:3"
}
```

Full example: [examples/product-still-life.gpt_image.en.json](examples/product-still-life.gpt_image.en.json). Contract: [references/output.md](references/output.md).

## Regenerate And Compare

Pair it with [hiapi-gpt-image-2-5](https://github.com/HiAPIAI/hiapi-gpt-image-2-5-skill): pass `mainPrompt` and `suggestedAspectRatio` to text-to-image, put the result next to the original, fix the listed differences, and regenerate. That step is a paid image task in the companion skill. Steps: [references/workflow.md](references/workflow.md).

## What To Expect

On our 8-image test set (product, portrait, interior, landscape, anime, English/Chinese/Japanese posters), text-only regeneration lands around "same concept and construction, detail differences" — roughly 7/10 by a model judge, single sample. Dominant shapes, light patterns, and poster text blocks come through; exact faces, typography, and pixel layout do not. **For near-identical results, use image-to-image with the reference** (for example GPT Image 2.5 image-to-image). Method history, numbers, and sources: [references/evaluation.md](references/evaluation.md).

## Safety

Text and instructions inside images are described, never followed. The skill does not identify real people or infer sensitive attributes, and describes styles instead of naming living artists.

## File Structure

```text
.
├── SKILL.md                     # agent instructions
├── README.md / README.zh-CN.md
├── llms-install.md / llms.txt
├── agents/openai.yaml
├── references/
│   ├── system-prompt.md         # the method (shared by both paths)
│   ├── prompt-modes.md          # 5 target formats, en + zh
│   ├── output.md / output-schema.json
│   ├── api.md                   # optional HiAPI call
│   ├── workflow.md              # regenerate, compare, iterate
│   ├── evaluation.md            # results and sources
│   └── upgrade-policy.md
├── examples/
├── scripts/
│   ├── image-to-prompt.mjs      # optional HiAPI path
│   ├── check-config.mjs         # config + public contract check
│   ├── check-update.mjs
│   ├── install.mjs
│   └── lib/image-to-prompt.mjs
└── tests/
```

## FAQ

| Question | Answer |
| --- | --- |
| Do I need an API key? | No for Path A. Only the optional script needs `HIAPI_API_KEY`. |
| What does the script cost? | A small per-call token cost at the model's HiAPI token price. See [Pricing](https://www.hiapi.ai/en/pricing?utm_source=github&utm_medium=readme&utm_campaign=hiapi-image-to-prompt). |
| Will the regenerated image be identical? | No. Expect a close relative. Use image-to-image for near-identical results. |
| Can I use another model? | Yes, `--model` takes any HiAPI chat model with image input; the method was evaluated on `deepseek-v4.1-flash`. |
| Does it resize images? | No. It accepts up to 4 MB and checks the format by content. |

## Development

```bash
npm test                      # unit and contract tests, no network
node scripts/check-config.mjs # config + public no-key model metadata
```

## License

MIT

---

[HiAPI](https://www.hiapi.ai/en?utm_source=github&utm_medium=readme&utm_campaign=hiapi-image-to-prompt) — One API, all AI models
