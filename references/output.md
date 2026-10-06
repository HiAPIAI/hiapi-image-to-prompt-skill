# Output contract

Both paths produce the same object. The script prints it with `--json`; otherwise it prints a readable version. The Agent path shows it as prompt, negative prompt, breakdown, and aspect ratio. JSON Schema: [output-schema.json](output-schema.json).

| Key | Type | Content |
| --- | --- | --- |
| `version` | `1` | Contract version. |
| `title` | string | Specific title, at most 12 words. |
| `summary` | string | One sentence: what the image is and how it is built. |
| `mainPrompt` | string | The regeneration prompt, 20–8000 characters, written for the chosen mode. |
| `negativePrompt` | string | Comma-separated likely reconstruction failures for this image, or `""`. |
| `subject`, `composition`, `lighting`, `colorPalette`, `camera`, `style`, `qualityDetails` | string[] | Short evidence items; `[]` when there is no evidence. |
| `suggestedAspectRatio` | string | `W:H`; the script overwrites it with the measured ratio. |

Natural-language fields use the requested language. Text copied from the image stays in its original language and is quoted verbatim.

## Validation

The script rejects, without retrying:

- empty content (usually the token cap was reached) — `OUTPUT_INVALID`;
- non-JSON content or a JSON object with missing or extra keys, wrong types, or a `mainPrompt` outside 20–8000 characters — `OUTPUT_INVALID`;
- a `refusal` key or a provider refusal — `CONTENT_NOT_ALLOWED`.

A leading Markdown code fence is tolerated. Try again or switch `--model` after an `OUTPUT_INVALID`.

## Example

[examples/product-still-life.gpt_image.en.json](../examples/product-still-life.gpt_image.en.json) is an unedited v3 result (method v6 changes only color and mood wording) for a 1200x900 product photo. When you regenerate, pass `suggestedAspectRatio` explicitly as the aspect ratio.
