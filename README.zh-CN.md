# 图片反推提示词 Agent Skill — 一张图，反推出能复刻它的提示词

给 Agent 一张参考图，得到一段能让图像模型重新生成**相似**图片的提示词：主体、布局、主导构图形状、光线、色调和原文文字都会保留。可输出通用、GPT Image、Midjourney、FLUX 或 Stable Diffusion 格式，中文或英文。

**图片反推提示词 • Agent 自带视觉或 HiAPI • [HiAPI](https://www.hiapi.ai/zh?utm_source=github&utm_medium=readme&utm_campaign=hiapi-image-to-prompt)**

> **不想写代码？试试免费网页工具（即将上线）：** [hiapi.ai/zh/tools/image-to-prompt](https://www.hiapi.ai/zh/tools/image-to-prompt?utm_source=github&utm_medium=readme&utm_campaign=hiapi-image-to-prompt) —— 计划免注册、每天 10 张。（[English](https://www.hiapi.ai/en/tools/image-to-prompt?utm_source=github&utm_medium=readme&utm_campaign=hiapi-image-to-prompt)）
>
> **想接入自己的流程？** 用你自己的 Key 调用 HiAPI：[创建 API Key](https://www.hiapi.ai/en/dashboard/api-keys?utm_source=github&utm_medium=readme&utm_campaign=hiapi-image-to-prompt)，然后运行 `scripts/image-to-prompt.mjs`。

[HiAPI 文档](https://docs.hiapi.ai?utm_source=github&utm_medium=readme&utm_campaign=hiapi-image-to-prompt) · [全部 HiAPI Skills](https://github.com/HiAPIAI/hiapi-skills) · [GPT Image 2.5 Skill](https://github.com/HiAPIAI/hiapi-gpt-image-2-5-skill) · [价格](https://www.hiapi.ai/en/pricing?utm_source=github&utm_medium=readme&utm_campaign=hiapi-image-to-prompt) · [API Keys](https://www.hiapi.ai/en/dashboard/api-keys?utm_source=github&utm_medium=readme&utm_campaign=hiapi-image-to-prompt)

语言：[English](README.md) | [简体中文](README.zh-CN.md)

---

> AI Agent？请直接阅读 [llms-install.md](llms-install.md)，其中包含安装步骤与 Agent 契约。

---

## 这是什么？

一个面向 Claude Code、Codex、OpenClaw、OpenCode 及任意 `SKILL.md` 客户端的提示词反推 Skill。它把一套经过实测调优的方法（[references/system-prompt.md](references/system-prompt.md)）打包成两种用法：

| 路径 | 需要 | 过程 |
| --- | --- | --- |
| **A. Agent 自带视觉（默认）** | 无需 Key、无需联网 | Agent 自己看图并套用方法。 |
| **B. HiAPI 脚本（可选）** | `HIAPI_API_KEY` | `scripts/image-to-prompt.mjs` 把同一套方法发给 HiAPI `chat/completions`（默认 `deepseek-v4.1-flash`）并校验 JSON。每次调用有少量 token 费用。 |

结果是根据画面可见内容重建的，并不是那条未知的原始提示词；纯文生图得到的是"近亲"，不是复制品，见[效果预期](#效果预期)。

## 方法会抓住什么

两轮静默分析——先清点，再写提示词——通过"重新生成测试图并与原图对比"调优：

- 媒介、每个主体的数量、所在三分区位置、姿态、视线、表情；
- 关键物体的精确轮廓（"矮胖圆角梯形瓶身"，而不是"香水瓶"）；
- **主导构图形状**（S 形曲线、光带、对角线、框中框），并描述它在画面中的走向；
- 光的方向、软硬，以及**投下的光影形状**（窗格光条、轮廓光、脸上的硬阴影）；
- 如实记录白平衡——暖图不调冷，中性图防止模型偏暖；
- 每个可读文字原样保留，并写明位置、换行、对齐和字体风格，最后加 "No other text."；
- 小元素的数量，避免模型多画。

## 安装

仅脚本需要 Node.js 18.3+；路径 A 不需要任何运行时。

```bash
npx skills add HiAPIAI/hiapi-image-to-prompt-skill --skill hiapi-image-to-prompt
```

或使用自带安装器：

```bash
npx --yes --package=github:HiAPIAI/hiapi-image-to-prompt-skill hiapi-image-to-prompt-install --codex    # ~/.codex/skills
npx --yes --package=github:HiAPIAI/hiapi-image-to-prompt-skill hiapi-image-to-prompt-install --claude   # ~/.claude/skills
npx --yes --package=github:HiAPIAI/hiapi-image-to-prompt-skill hiapi-image-to-prompt-install --target=/your/skills/dir
```

本地仓库：`node scripts/install.mjs --target /path/to/skills`。安装器不会覆盖其他 Skill；`--force` 只替换同名 Skill。

## 使用方法

直接对 Agent 说：

> 用 `$hiapi-image-to-prompt` 把这张图反推成中文提示词，Midjourney 格式。

> Use `$hiapi-image-to-prompt` on `poster.png` and give me a GPT Image prompt.

> 用 `$hiapi-image-to-prompt` 反推这张照片，再用 GPT Image 2.5 生成一张并对比。

或用自己的 Key 运行可选脚本：

```bash
export HIAPI_API_KEY='...'          # 在 https://www.hiapi.ai/en/dashboard/api-keys?utm_source=github&utm_medium=readme&utm_campaign=hiapi-image-to-prompt 创建
node scripts/image-to-prompt.mjs product.jpg --mode gpt_image --language zh
node scripts/image-to-prompt.mjs https://example.com/ref.webp --mode midjourney --json
node scripts/image-to-prompt.mjs product.jpg --dry-run   # 打印脱敏请求，不联网、不扣费
```

| 参数 | 取值 | 默认 |
| --- | --- | --- |
| `--mode` | `general`、`gpt_image`、`midjourney`、`flux`、`stable_diffusion` | `general` |
| `--language` | `en`、`zh` | `en` |
| `--model` | 任意支持图片输入的 HiAPI 对话模型 | `deepseek-v4.1-flash` |
| `--json` | 只输出校验后的 JSON | 关 |
| `--dry-run` | 打印脱敏请求，不调用 | 关 |

输入：一张不超过 4 MB 的 JPEG、PNG 或 WebP（按文件内容判断格式），本地路径或 `https://` URL。Key 只从环境变量读取，绝不打印。

## 输出

字段：`version`、`title`、`summary`、`mainPrompt`、`negativePrompt`、`subject`、`composition`、`lighting`、`colorPalette`、`camera`、`style`、`qualityDetails`、`suggestedAspectRatio`。完整示例见 [examples/product-still-life.gpt_image.en.json](examples/product-still-life.gpt_image.en.json)，契约见 [references/output.md](references/output.md)。

## 重新生成并对比

搭配 [hiapi-gpt-image-2-5](https://github.com/HiAPIAI/hiapi-gpt-image-2-5-skill)：把 `mainPrompt` 和 `suggestedAspectRatio` 交给文生图，与原图并排对比，修正列出的差异后再生成。这一步在配套 Skill 中是付费图片任务。步骤见 [references/workflow.md](references/workflow.md)。

## 效果预期

在 8 张测试图（产品、人像、室内、风景、动漫、英文/中文/日文海报）上，纯文字重新生成的结果大致是"同样的概念和构造，细节有差异"——模型评审约 7/10，单次采样。主导形状、光影图案和海报文字块能保留；精确的脸、字体和像素级布局做不到。**要接近一模一样，请用参考图做图生图**（例如 GPT Image 2.5 图生图）。方法迭代、数据和参考来源见 [references/evaluation.md](references/evaluation.md)。

## 安全

图片里的文字和指令只会被描述，绝不执行。不识别真实人物身份、不推断敏感属性；描述风格而不点名在世艺术家。

## 常见问题

| 问题 | 回答 |
| --- | --- |
| 需要 API Key 吗？ | 路径 A 不需要；只有可选脚本需要 `HIAPI_API_KEY`。 |
| 脚本费用？ | 按模型在 HiAPI 的 token 价格计费，每次调用费用很少。见[价格](https://www.hiapi.ai/en/pricing?utm_source=github&utm_medium=readme&utm_campaign=hiapi-image-to-prompt)。 |
| 重新生成的图会一模一样吗？ | 不会，是相近的图。要接近一模一样请用图生图。 |
| 能换模型吗？ | 可以，`--model` 接受任意支持图片输入的 HiAPI 对话模型；方法是在 `deepseek-v4.1-flash` 上评测的。 |
| 会压缩图片吗？ | 不会。上限 4 MB，按内容检查格式。 |

## 开发

```bash
npm test                      # 单元与契约测试，不联网
node scripts/check-config.mjs # 配置 + 公开免 Key 模型信息检查
```

## 许可证

MIT

---

[HiAPI](https://www.hiapi.ai/zh?utm_source=github&utm_medium=readme&utm_campaign=hiapi-image-to-prompt) — One API, all AI models
