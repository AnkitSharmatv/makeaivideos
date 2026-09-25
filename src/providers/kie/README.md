# KIE adapter — verified against docs.kie.ai (2026-09-20)

Sources: `https://docs.kie.ai/market/quickstart`, `/market/common/get-task-detail`,
`/common-api/get-account-credits`, `/veo3-api/generate-veo-3-video`, and one
`https://docs.kie.ai/market/<vendor>/<model>.md` page per catalog entry
(the `.md` pages embed the OpenAPI schema; that is what the catalog was
transcribed from).

## Auth
`Authorization: Bearer <key>` · keys at https://kie.ai/api-key

## Endpoints (all "Market" models, including Veo 3.1)
| Purpose | Call |
| --- | --- |
| Create task | `POST https://api.kie.ai/api/v1/jobs/createTask` — body `{ model, input, callBackUrl? }` → `{ code, msg, data: { taskId } }` |
| Poll | `GET https://api.kie.ai/api/v1/jobs/recordInfo?taskId=…` → `{ code, msg, data: { state, resultJson, failCode, failMsg, progress, … } }` |
| Validate key | `GET https://api.kie.ai/api/v1/chat/credit` → `{ code: 200, data: <credits> }` |

Notes confirmed:
- HTTP status is often **200 even on errors** — the envelope `code` is authoritative (401 auth, 402 credits, 422 validation, 429 rate limit, 455 maintenance, 505 disabled).
- `state` ∈ `waiting | queuing | generating | success | fail`.
- `resultJson` is a **JSON string**: `{"resultUrls":[…]}` for media.
- `callBackUrl` is optional; we poll instead.
- Rate limit: 20 new tasks / 10 s per account.
- Output retention is not stated on the docs; the adapter assumes **14 days** for the "may have expired" badge.
- No dimensions in the result; tile aspect is inferred from the `aspect_ratio` setting.

## Model ids used (transcribed from each model page)
Image: `google/nano-banana`, `google/nano-banana-edit`, `nano-banana-pro`, `nano-banana-2`, `nano-banana-2-lite`,
`seedream/4.5-text-to-image`, `bytedance/seedream-v4-text-to-image`, `seedream/5-pro-text-to-image`,
`seedream/5-pro-image-to-image`, `seedream/5-lite-text-to-image`, `flux-2/pro-text-to-image`, `z-image`,
`qwen/text-to-image`, `qwen3/pro-text-to-image`, `gpt-image/1.5-text-to-image`, `gpt-image-2-text-to-image`,
`gpt-image-2-image-to-image`, `gpt-image-2-5-flare-text-to-image`, `gpt-image-2-5-flare-image-to-image`,
`gpt-image-2-5-sunburst-text-to-image`, `gpt-image-2-5-sunburst-image-to-image`, `ideogram/v3-text-to-image`,
`google/imagen4`, `grok-imagine-image-2-0/text-to-image`, `grok-imagine-image-2-0/image-edit`, `wan/2-7-image-pro`.

Video (52): Veo 3.1; Seedance 2.5 / 2.0 / 2.0 Fast / 2.0 Mini / 1.5 Pro / 1.0 Pro & Lite (t2v + i2v); Kling 3.0
(`kling-3.0/video`, std/pro/4K), Kling 3.0 Turbo, Kling 3.0 Omni, Kling 2.6, Kling 2.5 Turbo Pro, Kling 2.1 Master / Pro /
Standard; Wan 3.0 / 3.0 Prime / 2.7 / 2.6 / 2.6 Flash / 2.5 / 2.2 A14B Turbo; Hailuo 03 (MiniMax H3) / 2.3 Pro & Standard /
02 Pro & Standard; Grok Imagine Video 1.5 / Grok Imagine; PixVerse V6 (t2v, i2v); HappyHorse 1.1 / 1.0; Gemini Omni /
Omni 1.1 Flash. Exact ids are the `id` fields in `catalog.ts`; each was transcribed from its `docs.kie.ai/market/...md` schema.
Left out on purpose: utility endpoints (upscale, extend, lip-sync, motion control, animate, video-to-video edits,
reference-to-video modes that need video/audio inputs) and Runway/4o legacy APIs that use non-Market endpoints.

Known doc inconsistencies:
- The Kling 2.5 Turbo *image-to-video* page's schema enum says `kling/v2-1-master-image-to-video` while its
  description says the model must be `kling/v2-5-turbo-image-to-video-pro`. The adapter uses the latter.
- Kling 3.0 Omni defaults `customize_multi_shots` to `true`, which then requires `multi_prompt`; the adapter
  sends `customize_multi_shots: false` so the single `prompt` is used.
- Veo 3.1 `duration` is an integer 4|6|8; `generation_type` is set from whether frames are attached.

## Pricing (cost hints)
1 credit = **$0.005** (kie.ai/pricing). Per-model credits were transcribed from the `pricingDesc` field of each
model's kie.ai landing page on 2026-09-20 (e.g. Nano Banana 4 cr; Nano Banana Pro 8 cr 1K/2K · 14 cr 4K;
Nano Banana 2 8/12/18 cr; Seedream 4.5 6.5 cr; FLUX.2 Pro 14/24 cr; Kling 2.6 55/110 cr ×2 with sound;
Kling 3.0 14–20 cr/s (67 cr/s at 4K); Veo 3.1 Quality 250/255/370 cr; Wan 2.6 70–315 cr; Seedance 2.0
19–208 cr/s; PixVerse 4–18.4 cr/s). They are estimates: the app also reads `creditsConsumed` from
`recordInfo` after every run and uses that observed number for the same model + settings next time.

GPT Image 2.5 / 2: 6 cr 1K · 10 cr 2K · 16 cr 4K (kie.ai/gpt-image-2-5 lists one rate; Sunburst may differ — the
observed `creditsConsumed` corrects it after the first run). Seedream 5 Pro 7/14 cr, Lite 5.5 cr; Nano Banana 2 Lite 4 cr;
Grok Image 2.0 4 cr; Qwen 3 Pro 6.4/12 cr; Wan 2.7 Image Pro 12 cr.

Open question: KIE's Veo docs mention Fast (60 cr) and Lite (30 cr) tiers but the `createTask` schema only
documents `model: "veo-3-1"`; the fast/lite ids aren't published there, so only the Quality tier is in the catalog.

## Uploads (media inputs)
`POST https://kieai.redpandaai.co/api/file-stream-upload` (multipart `file`, `uploadPath`, `fileName`; `Authorization: Bearer`)
→ `{ code: 200, data: { downloadUrl } }`. Uploads are free and **deleted after 24 h**, so the app keeps the original
bytes in IndexedDB and re-uploads automatically when a stored URL is past its expiry. Verified live on 2026-09-20.

## Balance
`GET /api/v1/chat/credit` → `{ code: 200, data: <credits> }` is shown in the topbar (credits and ≈ USD at $0.005/cr),
refreshed on sign-in, after each run, after saving a key, and on click. "Get a key" and "Recharge" point to the referral link https://gotolink.cc/kie (disclosed in README.md).

Single-image limits (learned from live 500s, not stated in the schema): `kling/v3-turbo-image-to-video` and
`kling-2.6/image-to-video` accept exactly one `image_urls` entry — start frame only. First + last frame on KIE:
Kling 3.0 (`kling-3.0/video`), Kling 3.0 Omni image-to-video, Kling 2.5 Turbo Pro / 2.1 Pro (`tail_image_url`),
Seedance, Veo 3.1, Wan 2.7, Hailuo 02, MiniMax H3, PixVerse.
