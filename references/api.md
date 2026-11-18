# API contract (optional script path)

`scripts/image-to-prompt.mjs` makes one OpenAI-compatible chat completion call to HiAPI. The Agent-vision path (Path A in [SKILL.md](../SKILL.md)) makes no call at all.

## Request

```http
POST https://api.hiapi.ai/v1/chat/completions
Authorization: Bearer $HIAPI_API_KEY
Content-Type: application/json
```

```json
{
  "model": "deepseek-v4.1-flash",
  "max_tokens": 8000,
  "response_format": { "type": "json_object" },
  "messages": [
    { "role": "system", "content": "<references/system-prompt.md without HTML comments and the agent-only block>" },
    { "role": "user", "content": [
      { "type": "text", "text": "Analyze this reference image.\nOutput language: English.\nSource dimensions: 1200x900.\nClosest common aspect ratio: 4:3.\nOutput adaptation: <mode instruction>\nReturn only the JSON object." },
      { "type": "image_url", "image_url": { "url": "data:image/jpeg;base64,...", "detail": "high" } }
    ] }
  ]
}
```

`node scripts/image-to-prompt.mjs <image> --dry-run` prints exactly this payload with the system prompt and image data redacted. It makes no network call.

| Field | Value | Why |
| --- | --- | --- |
| `model` | `deepseek-v4.1-flash` (override with `--model`) | Vision-capable, low token price on HiAPI; the model used in the evaluation. Any HiAPI chat model with image input can be tried. |
| `response_format` | `json_object` | Strict `json_schema` made the model run to the token cap with empty content on a text-heavy Japanese poster (see [evaluation.md](evaluation.md)). The script validates keys locally instead. |
| `max_tokens` | `8000` | Reasoning tokens count against it; text-heavy posters need room. |
| image | data URI, JPEG/PNG/WebP, ≤ 4 MB | Checked by magic bytes. Local paths and `https://` URLs are read by the script and sent inline; nothing is uploaded elsewhere. No resizing. |

## Runtime behavior

- Timeout: 120 s per call. A timeout is **not** retried, so an accepted but slow call is not billed twice.
- Retry: exactly one retry, only when the request failed before any HTTP status arrived (DNS, connection reset).
- HTTP errors are reported once with a hint: 401 key, 402 balance, 403 permission, 404 model, 429 rate limit, 5xx upstream.
- `suggestedAspectRatio` is replaced by the ratio measured from the image header (closest of 1:1, 4:3, 3:2, 16:9, 3:4, 2:3, 9:16), the same rule the web tool uses.
- Before a live call the script checks the update policy (see [upgrade-policy.md](upgrade-policy.md)). `--dry-run` skips it.

## Environment

| Variable | Required | Meaning |
| --- | --- | --- |
| `HIAPI_API_KEY` | live calls only | Bearer key. Read at runtime, never printed or written. |
| `HIAPI_BASE_URL` | no | API base, default `https://api.hiapi.ai`. |
| `HIAPI_SKIP_UPDATE_CHECK` | no | `1` disables the update check. |

## Cost

Each live call spends a small per-call token cost at the model's HiAPI token price (input image + system prompt + output JSON). In our October 2026 tests with `deepseek-v4.1-flash` this was roughly US$0.002–0.004 per image; that is an observation, not a price guarantee. Current prices: https://www.hiapi.ai/en/pricing?utm_source=skill&utm_medium=agent&utm_campaign=hiapi-image-to-prompt.
