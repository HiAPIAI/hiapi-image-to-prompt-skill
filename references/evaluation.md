# Evaluation

How the method in [system-prompt.md](system-prompt.md) was tuned, and what it can and cannot do. Re-run this before changing the system prompt or the default model, on the same image set, and promote a version only if it improves fidelity or reduces hallucination — not because it is longer.

## Setup (2026-10-06)

- **Describer**: `deepseek-v4.1-flash` via HiAPI chat/completions, image sent at up to 1600 px.
- **Regenerator**: `gpt-image-2.5-flare/text-to-image`, 1K, the describer's `mainPrompt` and aspect ratio, no reference image.
- **Judge**: `deepseek-v4.1-flash` comparing original and regenerated image, overall score 0–10.
- **Images (8)**: product photo, portrait, interior, landscape, anime character, English poster, Chinese poster, Japanese text-heavy poster.
- **Samples**: one per image per version. These are single-sample, model-judged numbers; read them as direction, not as a benchmark.

## Results

| Version | Change | Described | Mean overall | Visible effect |
| --- | --- | --- | --- | --- |
| v0 | Ported VisuCue prompt, strict `json_schema` | 7/8 | 7.00 (on 7) | Japanese text-heavy poster failed 3/3: under strict `json_schema` the model ran to the token cap with empty content. |
| v1 | Inventory → prompt two-pass; positions; silhouettes; verbatim text with layout; `json_object` | 8/8 | 6.88 | Anime expression, bottle silhouette, and the poster's left-aligned text block fixed; Japanese poster reproduced. |
| v2 | + trace the dominant compositional shape; cast-light shapes; small-element counts; no invented details | 8/8 | 7.00 | English poster's S-curve river ribbon recovered; interior window-light stripes recovered. |
| v3 | + white balance as observed; never cool a warm image; hard face shadows | 4-image check | — | Chinese poster's light ribbon now S-curves through the skyline. |

v3 is the shipped method.

## Conclusion

Text-only regeneration plateaus around "same concept and construction, detail differences" (about 7/10 by this judge). The prompt reliably carries medium, layout, dominant shape, light, palette, and quoted text; it does not carry exact faces, exact typography, or pixel-level arrangement. For near-identical results use image-to-image with the reference (for example GPT Image 2.5 image-to-image) — see [workflow.md](workflow.md).

Known slip: the describer occasionally writes a wrong orientation word (the shipped example says "vertical" for a 4:3 landscape photo). The script overwrites `suggestedAspectRatio` with the measured ratio; pass it explicitly when regenerating.

## Research that shaped the rules

- OpenAI, image generation prompting guide — structure (scene → subject → details), quoted literal text, explicit layout: https://developers.openai.com/cookbook/examples/multimodal/image-gen-models-prompting-guide
- Black Forest Labs, FLUX prompting — subject first, natural language, positions and relationships over keyword lists: https://docs.bfl.ai/guides/prompting_unified_building
- JoyCaption — descriptive captioning modes and target-specific caption styles: https://github.com/fpgaminer/joycaption
- CLIP Interrogator — limits of tag-style reverse prompts (medium/artist/flavor tags): https://github.com/pharmapsychotic/clip-interrogator
- OpenAI, DALL·E 3 "Improving Image Generation with Better Captions" — dense, detailed captions improve prompt following: https://cdn.openai.com/papers/dall-e-3.pdf
- jiemianduan/image-to-prompt — prior open-source image-to-prompt tool: https://github.com/jiemianduan/image-to-prompt

The method also inherits from the VisuCue `image-to-prompt` skill (MIT, by the same team). No third-party system prompt is copied.

## Rubric for the next run

Score each pair 0–4 on: subject fidelity, composition, light and color, material and style, hallucination control, generation usefulness, output validity. Record model, skill version, tokens, cost, latency, and failures. Widen the set toward 20 images (4 product, 4 people, 4 illustration/anime, 4 environments, 2 text-heavy, 2 multi-subject) before claiming a general improvement.
