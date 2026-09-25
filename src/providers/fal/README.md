# FAL adapter — verified against fal.ai docs (2026-09-20)

Sources: `https://fal.ai/docs/model-apis/model-endpoints/queue` and, per model, the
machine-readable schema at `https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=<model>`.

## Auth
`Authorization: Key <key>` · keys at https://fal.ai/dashboard/keys (format `id:secret`).

## Endpoints
| Purpose | Call |
| --- | --- |
| Submit | `POST https://queue.fal.run/{model_id}` → `{ request_id, status_url, response_url, cancel_url, queue_position }` |
| Status | `GET https://queue.fal.run/{base}/requests/{request_id}/status` → `{ status: IN_QUEUE \| IN_PROGRESS \| COMPLETED, queue_position? }` |
| Result | `GET https://queue.fal.run/{base}/requests/{request_id}` → model output (`images[]` or `video{}`) |
| Cancel | `PUT https://queue.fal.run/{base}/requests/{request_id}/cancel` → 202 |
| Validate key | `GET https://api.fal.ai/v1/models?limit=1` → 200 / 401 `{"error":{"type":"authorization_error"}}` |

Notes confirmed:
- `{base}` is taken from the `status_url` FAL returns on submit (the app alias), not rebuilt from the model id. The
  adapter encodes it into the job id as `<base>|<request_id>`.
- Image outputs: `images[]` of `{ url, width, height, content_type }`. Video outputs: `video: { url }`.
- `has_nsfw_concepts[]` accompanies some image models; all-true is mapped to `code: "nsfw"`.
- Output retention is not formally stated; the adapter assumes **7 days**.
- Models with `num_images` run as a native batch (one request, N images).

## Model ids used
Image: `fal-ai/flux/dev`, `fal-ai/flux-pro/v1.1-ultra`, `fal-ai/flux-2-pro`, `fal-ai/nano-banana`,
`fal-ai/nano-banana/edit`, `fal-ai/nano-banana-pro`, `fal-ai/bytedance/seedream/v4/text-to-image`.

Video: `fal-ai/veo3.1`, `fal-ai/veo3.1/image-to-video`, `fal-ai/kling-video/v2.5-turbo/pro/text-to-video`,
`fal-ai/kling-video/v2.5-turbo/pro/image-to-video`, `fal-ai/kling-video/v3/pro/text-to-video`,
`fal-ai/minimax/hailuo-02/pro/text-to-video`, `fal-ai/bytedance/seedance/v1/pro/text-to-video`, `fal-ai/sora-2/text-to-video`.

Not found on FAL (404 from the schema endpoint, so left out): `fal-ai/imagen4/preview`, `fal-ai/wan/v2.6/text-to-video`.

## Pricing (cost hints)
USD rates transcribed from each model page's `pricingInfoOverride` on 2026-09-20 (FLUX.1 dev $0.025/MP;
FLUX 1.1 Pro Ultra $0.06; FLUX.2 Pro $0.03 + $0.015/extra MP; Nano Banana $0.039; Nano Banana Pro $0.15, ×2 at 4K;
Seedream 4 $0.03; Veo 3.1 $0.20/s or $0.40/s with audio, $0.40/$0.60 at 4K; Kling 2.5 Turbo Pro $0.35 per 5 s + $0.07/s;
Kling 3.0 Pro $0.112/s or $0.168/s with audio; Hailuo 02 Pro $0.48; Seedance 1.0 Pro $2.5 per 1M video tokens;
Sora 2 $0.10/s). FAL does not return the actual charge in the result, so these stay estimates.

## Uploads (media inputs)
`POST https://rest.alpha.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3` `{ content_type, file_name }` →
`{ upload_url, file_url }`, then `PUT upload_url` with the bytes — the sequence `@fal-ai/client` uses. Not exercised
against a live key in this project.

## Balance
`GET https://rest.alpha.fal.ai/billing/user_balance` (the dashboard's endpoint; returns 401 on a bad key, so it exists,
but the response shape is undocumented — the adapter accepts a bare number or `{ balance }` / `{ user_balance }` and
otherwise shows nothing). "Get a key" and "Recharge" point to the referral link https://gotolink.cc/fal (disclosed in README.md).
