# Higgsfield adapter — verified against docs.higgsfield.ai (2026-09-20)

Sources: `https://docs.higgsfield.ai/docs/llms-full.txt` (concepts + per-model pages),
`/docs/openapi.json` (supplementary), `/docs/concepts/requests`, `/docs/concepts/billing-and-retention`,
`/docs/concepts/file-uploads`.

## Auth
`Authorization: Key <key_id>:<key_secret>` · keys at https://console.higgsfield.ai

## Base URL — differs from the build spec
The spec listed `https://platform.higgsfield.ai`; the current docs use **`https://api.higgsfield.ai`**.
The adapter uses the documented host.

## Endpoints
| Purpose | Call |
| --- | --- |
| Submit | `POST https://api.higgsfield.ai/{endpoint id}` → `{ status: "queued", request_id, status_url, cancel_url }` |
| Poll | `GET https://api.higgsfield.ai/requests/{request_id}/status` → `{ status, request_id, error?, images?[{url}], video?{url} }` |
| Cancel | `POST https://api.higgsfield.ai/requests/{request_id}/cancel` → 202 (400 once processing started) |
| Estimate | `POST https://api.higgsfield.ai/estimate/{endpoint id}` (same body) → `{ credits, usd }` — used for key validation |
| Upload URL | `POST https://api.higgsfield.ai/files/generate-upload-url` `{ content_type }` → `{ public_url, upload_url, upload_headers }` |

Notes confirmed:
- `status` ∈ `queued | in_progress | completed | failed | nsfw | canceled`. `failed` and `nsfw` are not charged.
- Output URLs are retained **at least 7 days**.
- Image outputs arrive as `images[]`; video as `video.url`.
- No dimensions in the response; tile aspect is inferred from the `aspect_ratio` setting.
- Docs give supported values per field but not always defaults; the catalog picks the documented example value as default.

## Endpoint ids used
Image: `higgsfield-ai/soul/v2/standard`, `higgsfield-ai/soul/standard`, `xai/grok-imagine-image-2.0`,
`recraft/v4.1/pro/text-to-image`.

Video: `kling-video/v3.0/std/text-to-video`, `kling-video/v3.0/std/image-to-video`, `kling-video/v3.0-turbo/text-to-video`,
`kling-video/v2.5-turbo/pro/text-to-video`, `kling-video/v2.5-turbo/pro/image-to-video`,
`bytedance/seedance-2.5/text-to-video`, `bytedance/seedance-2.5/image-to-video`, `bytedance/seedance-2.0/text-to-video`,
`minimax/hailuo-2.3/standard/text-to-video`, `minimax/hailuo-2.3/standard/image-to-video`,
`alibaba/wan-3.0/text-to-video`, `alibaba/wan-3.0/image-to-video`.

Field-name caveats: SOUL takes `batch_size` (1 or 4) not `num_images`; Kling 3.0 `sound` is the string `"on"|"off"`;
Seedance 2.5 wants `output_format: "mp4"`.

## Pricing (cost hints)
Higgsfield quotes live: the composer calls `POST /estimate/{endpoint}` (debounced) with the exact request body and
shows the returned `credits` and `usd`. No published table is hardcoded.

## Uploads (media inputs)
`POST /files/generate-upload-url` `{ content_type }` → `{ public_url, upload_url, upload_headers }`, then `PUT upload_url`
with every header returned (docs.higgsfield.ai/docs/concepts/file-uploads). Presigned URL lives 1 h; storage is tagged
`retention=temporary`, so the app treats the public URL as good for 24 h and re-uploads after that.

## Balance
No balance endpoint is documented, so the topbar shows only the Recharge link for Higgsfield.
"Get a key" and "Recharge" point to the referral link https://gotolink.cc/hgapi (disclosed in README.md).

## Explore catalog (2026-09-21)
open.higgsfield.ai/explore is fed by `GET https://dash.higgsfield.ai/api/v2/catalog-models/` (public, paginated),
and each model page embeds its input JSON schema. Added from it: Ideogram 4.0 (`ideogram/v4.0`), Qwen Image 3
(`alibaba/qwen-image-3/text-to-image`), Z-Image Turbo (`z-image/turbo`), Marketing Studio Image
(`marketing-studio/image`, without presets), Recraft V4.1 (`recraft/v4.1/text-to-image`), MiniMax H3, LTX 2.5
Fast/Pro, Grok Imagine Video 1.5, Wan 2.7, Wan 2.6, Happy Horse 1.0/1.1, PixVerse 6, Kling O3, Kling O1 (Omni),
Kling 2.6 Pro, Kling 2.5 Turbo Standard i2v, Cinema Studio 4.0, Genjutsu Motion Transfer (endpoint id is spelled
`higgsfiled/…` upstream). USD rates in the catalog come from that API's discounted `pricing.primary.amount`; the
live `/estimate` quote still overrides them in the composer.

Not added (need new UI): Marketing Studio `preset_id` (list from `/marketing-studio/image/presets`), SOUL `style_id`
(`/v1/text2image/soul-styles/v2`), Kling 3.0 `elements` (pre-created element ids), `multi_shots`/`multi_prompt`,
and audio inputs (`audio_url`, `audio_urls`).
