# Prompt modes

The mode only changes how `mainPrompt` (and, for Stable Diffusion, `negativePrompt`) is written. The analysis method in [system-prompt.md](system-prompt.md) is identical for every mode. `{ratio}` is the closest common aspect ratio of the source image (1:1, 4:3, 3:2, 16:9, 3:4, 2:3, 9:16).

The script sends this user message next to the image; in Agent mode, apply the same instruction yourself:

```text
Analyze this reference image.
Output language: English | Simplified Chinese.
Source dimensions: {width}x{height}.
Closest common aspect ratio: {ratio}.
Output adaptation: <mode instruction below, in the output language>
Return only the JSON object.
```

Pick the mode from the target model the user names. Use `gpt_image` when the next step is regenerating with [hiapi-gpt-image-2-5](https://github.com/HiAPIAI/hiapi-gpt-image-2-5-skill). Use `general` when no target is named.

## `general` — General (model-neutral)

- en: General mode: write mainPrompt as one detailed, model-neutral, copy-ready natural-language image-generation prompt.
- zh: 通用描述模式：mainPrompt 写成一条详细、模型中立、可复制的自然语言图片生成提示词。

## `gpt_image` — GPT Image

- en: GPT Image mode: write mainPrompt as clear, complete natural language in scene, subject, composition, lighting, material, and style order. Preserve visible text in quotation marks. Do not add Midjourney or Stable Diffusion parameters.
- zh: GPT Image 模式：mainPrompt 使用清晰、自然的完整语句，按场景、主体、构图、光线、材质、风格的顺序描述；对可见文字使用引号保留原文，不添加 Midjourney 或 Stable Diffusion 参数。

## `midjourney` — Midjourney

- en: Midjourney mode: write mainPrompt as coherent Midjourney-ready natural language and append --ar {ratio} exactly once. Do not add model versions, stylize values, or invisible parameters.
- zh: Midjourney 模式：mainPrompt 使用连贯的 Midjourney 自然语言描述，并在末尾追加一次 --ar {ratio}。不要添加模型版本、风格化数值或不可见参数。

## `flux` — FLUX

- en: FLUX mode: write mainPrompt as concise, coherent natural language. Prioritize subject, material, space, lighting, and style. Do not add platform commands or parameters.
- zh: FLUX 模式：mainPrompt 使用简洁、连贯的自然语言描述，优先保留主体、材质、空间、光线和风格，不添加平台命令或参数。

## `stable_diffusion` — Stable Diffusion

- en: Stable Diffusion mode: write mainPrompt as clear comma-separated positive tags and negativePrompt as comma-separated negative tags. Do not add samplers, seeds, or weights.
- zh: Stable Diffusion 模式：mainPrompt 使用清晰的逗号分隔正向标签；negativePrompt 使用逗号分隔的负向标签。不要添加采样器、种子或权重。
