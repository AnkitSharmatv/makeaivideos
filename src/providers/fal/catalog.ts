import type { GenerateInput, ModelSpec, SettingValue } from "../types";
import { m, s, firstUrl, urls, usdPrice, megapixels, seconds } from "../catalog-utils";

/** Rates from each model's fal.ai page, 2026-09-20. `count` is the native batch size. */
const perImage = (usd: number) => usdPrice((_st, count) => usd * count);

export type FalEntry = ModelSpec & {
  body: (input: GenerateInput, settings: Record<string, SettingValue>, count: number) => Record<string, unknown>;
};

const P = "fal" as const;

const std = (input: GenerateInput, settings: Record<string, SettingValue>): Record<string, unknown> => ({
  prompt: input.prompt,
  ...settings,
});
const withNeg = (input: GenerateInput, body: Record<string, unknown>): Record<string, unknown> =>
  input.negativePrompt ? { ...body, negative_prompt: input.negativePrompt } : body;
const withSeed = (input: GenerateInput, body: Record<string, unknown>): Record<string, unknown> =>
  input.seed !== undefined ? { ...body, seed: input.seed } : body;

const IMAGE_SIZES = ["square_hd", "square", "portrait_4_3", "portrait_16_9", "landscape_4_3", "landscape_16_9"];

export const FAL_CATALOG: FalEntry[] = [
  // ───────────────────────────── IMAGE ─────────────────────────────
  {
    id: "fal-ai/flux/dev",
    provider: P,
    name: "FLUX.1 [dev]",
    kind: "image",
    settings: [
      s.enum("image_size", "Size", IMAGE_SIZES, "landscape_4_3"),
      s.number("guidance_scale", "Guidance", 1, 20, 0.5, 3.5),
      s.number("num_inference_steps", "Steps", 1, 50, 1, 28),
      s.enum("output_format", "Format", ["jpeg", "png"], "jpeg"),
    ],
    media: [],
    batch: { native: true, max: 4 },
    advanced: { seed: true },
    price: usdPrice((st, count) => 0.025 * Math.max(1, megapixels(st)) * count),
    body: (i, st, n) => withSeed(i, { ...std(i, st), num_images: n }),
  },
  {
    id: "fal-ai/flux-pro/v1.1-ultra",
    provider: P,
    name: "FLUX 1.1 Pro Ultra",
    kind: "image",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["21:9", "16:9", "4:3", "3:2", "1:1", "2:3", "3:4", "9:16", "9:21"], "16:9"),
      s.bool("raw", "Raw mode", false),
      s.enum("output_format", "Format", ["jpeg", "png"], "jpeg"),
    ],
    media: [],
    batch: { native: true, max: 4 },
    advanced: { seed: true },
    notes: "Up to 2K.",
    price: perImage(0.06),
    body: (i, st, n) => withSeed(i, { ...std(i, st), num_images: n }),
  },
  {
    id: "fal-ai/flux-2-pro",
    provider: P,
    name: "FLUX.2 Pro",
    kind: "image",
    settings: [s.enum("image_size", "Size", IMAGE_SIZES, "landscape_4_3"), s.enum("output_format", "Format", ["jpeg", "png"], "jpeg")],
    media: [],
    batch: { native: false, max: 4 },
    advanced: { seed: true },
    price: usdPrice((st) => 0.03 + 0.015 * Math.max(0, Math.ceil(megapixels(st)) - 1)),
    body: (i, st) => withSeed(i, std(i, st)),
  },
  {
    id: "fal-ai/nano-banana",
    provider: P,
    name: "Nano Banana",
    kind: "image",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "5:4", "4:5", "21:9"], "1:1"),
      s.enum("output_format", "Format", ["png", "jpeg", "webp"], "png"),
    ],
    media: [],
    batch: { native: true, max: 4 },
    advanced: { seed: true },
    price: perImage(0.039),
    body: (i, st, n) => withSeed(i, { ...std(i, st), num_images: n }),
  },
  {
    id: "fal-ai/nano-banana/edit",
    provider: P,
    name: "Nano Banana Edit",
    kind: "image",
    settings: [s.enum("output_format", "Format", ["png", "jpeg", "webp"], "png")],
    media: [m.reference(10, 1)],
    batch: { native: true, max: 4 },
    advanced: { seed: true },
    price: perImage(0.039),
    body: (i, st, n) => withSeed(i, { ...std(i, st), num_images: n, image_urls: urls(i, "reference") }),
  },
  {
    id: "fal-ai/nano-banana-pro",
    provider: P,
    name: "Nano Banana Pro",
    kind: "image",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "5:4", "4:5", "21:9"], "1:1"),
      s.enum("resolution", "Resolution", ["1K", "2K", "4K"], "1K"),
      s.enum("output_format", "Format", ["png", "jpeg", "webp"], "png"),
    ],
    media: [],
    batch: { native: true, max: 4 },
    advanced: { seed: true },
    price: usdPrice((st, count) => (st.resolution === "4K" ? 0.3 : 0.15) * count),
    body: (i, st, n) => withSeed(i, { ...std(i, st), num_images: n }),
  },
  {
    id: "fal-ai/bytedance/seedream/v4/text-to-image",
    provider: P,
    name: "Seedream 4.0",
    kind: "image",
    settings: [s.enum("image_size", "Size", IMAGE_SIZES, "square_hd")],
    media: [],
    batch: { native: true, max: 4 },
    advanced: { seed: true },
    price: perImage(0.03),
    body: (i, st, n) => withSeed(i, { ...std(i, st), num_images: n, max_images: n }),
  },

  // ───────────────────────────── VIDEO ─────────────────────────────
  {
    id: "fal-ai/veo3.1",
    provider: P,
    name: "Veo 3.1",
    kind: "video",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["16:9", "9:16"], "16:9"),
      s.enum("resolution", "Resolution", ["720p", "1080p", "4k"], "720p"),
      s.enum("duration", "Duration", ["4s", "6s", "8s"], "8s"),
      s.bool("generate_audio", "Audio", true),
    ],
    media: [],
    batch: { native: false, max: 2 },
    advanced: { negativePrompt: true, seed: true },
    price: usdPrice((st) => seconds(st.duration, 8) * (st.resolution === "4k" ? (st.generate_audio ? 0.6 : 0.4) : st.generate_audio ? 0.4 : 0.2)),
    body: (i, st) => withSeed(i, withNeg(i, std(i, st))),
  },
  {
    id: "fal-ai/veo3.1/image-to-video",
    provider: P,
    name: "Veo 3.1 · Image to video",
    kind: "video",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["auto", "16:9", "9:16"], "auto"),
      s.enum("resolution", "Resolution", ["720p", "1080p", "4k"], "720p"),
      s.enum("duration", "Duration", ["4s", "6s", "8s"], "8s"),
      s.bool("generate_audio", "Audio", true),
    ],
    media: [m.start()],
    batch: { native: false, max: 2 },
    advanced: { negativePrompt: true, seed: true },
    price: usdPrice((st) => seconds(st.duration, 8) * (st.resolution === "4k" ? (st.generate_audio ? 0.6 : 0.4) : st.generate_audio ? 0.4 : 0.2)),
    body: (i, st) => withSeed(i, withNeg(i, { ...std(i, st), image_url: firstUrl(i, "start") })),
  },
  {
    id: "fal-ai/kling-video/v2.5-turbo/pro/text-to-video",
    provider: P,
    name: "Kling 2.5 Turbo Pro",
    kind: "video",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["16:9", "9:16", "1:1"], "16:9"),
      s.enum("duration", "Duration", ["5", "10"], "5"),
      s.number("cfg_scale", "CFG", 0, 1, 0.1, 0.5),
    ],
    media: [],
    batch: { native: false, max: 2 },
    advanced: { negativePrompt: true },
    price: usdPrice((st) => 0.35 + 0.07 * Math.max(0, seconds(st.duration, 5) - 5)),
    body: (i, st) => withNeg(i, std(i, st)),
  },
  {
    id: "fal-ai/kling-video/v2.5-turbo/pro/image-to-video",
    provider: P,
    name: "Kling 2.5 Turbo Pro · Image to video",
    kind: "video",
    settings: [s.enum("duration", "Duration", ["5", "10"], "5"), s.number("cfg_scale", "CFG", 0, 1, 0.1, 0.5)],
    media: [m.start(), m.end()],
    batch: { native: false, max: 2 },
    advanced: { negativePrompt: true },
    price: usdPrice((st) => 0.35 + 0.07 * Math.max(0, seconds(st.duration, 5) - 5)),
    body: (i, st) => {
      const tail = firstUrl(i, "end");
      return withNeg(i, { ...std(i, st), image_url: firstUrl(i, "start"), ...(tail ? { tail_image_url: tail } : {}) });
    },
  },
  {
    id: "fal-ai/kling-video/v3/pro/text-to-video",
    provider: P,
    name: "Kling 3.0 Pro",
    kind: "video",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["16:9", "9:16", "1:1"], "16:9"),
      s.number("duration", "Duration", 3, 15, 1, 5, "s"),
      s.number("cfg_scale", "CFG", 0, 1, 0.1, 0.5),
      s.bool("generate_audio", "Audio", true),
    ],
    media: [],
    batch: { native: false, max: 2 },
    advanced: { negativePrompt: true },
    price: usdPrice((st) => seconds(st.duration, 5) * (st.generate_audio ? 0.168 : 0.112)),
    body: (i, st) => withNeg(i, { ...std(i, st), duration: String(st.duration), shot_type: "customize" }),
  },
  {
    id: "fal-ai/minimax/hailuo-02/pro/text-to-video",
    provider: P,
    name: "Hailuo 02 Pro",
    kind: "video",
    settings: [s.bool("prompt_optimizer", "Optimize prompt", true)],
    media: [],
    batch: { native: false, max: 2 },
    notes: "1080p, 6s.",
    price: usdPrice(() => 0.48),
    body: std,
  },
  {
    id: "fal-ai/bytedance/seedance/v1/pro/text-to-video",
    provider: P,
    name: "Seedance 1.0 Pro",
    kind: "video",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"], "16:9"),
      s.enum("resolution", "Resolution", ["480p", "720p", "1080p"], "1080p"),
      s.enum("duration", "Duration", ["2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"], "5"),
      s.bool("camera_fixed", "Lock camera", false),
    ],
    media: [],
    batch: { native: false, max: 2 },
    advanced: { seed: true },
    price: usdPrice((st) => {
      const dims: Record<string, [number, number]> = { "480p": [854, 480], "720p": [1280, 720], "1080p": [1920, 1080] };
      const [w, h] = dims[String(st.resolution)] ?? dims["1080p"]!;
      const tokens = (w * h * 24 * seconds(st.duration, 5)) / 1024;
      return (tokens / 1_000_000) * 2.5;
    }),
    body: (i, st) => withSeed(i, std(i, st)),
  },
  {
    id: "fal-ai/sora-2/text-to-video",
    provider: P,
    name: "Sora 2",
    kind: "video",
    settings: [s.enum("aspect_ratio", "Aspect", ["16:9", "9:16"], "16:9"), s.number("duration", "Duration", 4, 20, 4, 4, "s")],
    media: [],
    batch: { native: false, max: 2 },
    notes: "Duration 4/8/12/16/20s. 720p.",
    price: usdPrice((st) => 0.1 * seconds(st.duration, 4)),
    body: (i, st) => {
      const allowed = [4, 8, 12, 16, 20];
      const d = Number(st.duration);
      const duration = allowed.reduce((best, x) => (Math.abs(x - d) < Math.abs(best - d) ? x : best), 4);
      return { prompt: i.prompt, aspect_ratio: st.aspect_ratio, duration, resolution: "720p" };
    },
  },
];
