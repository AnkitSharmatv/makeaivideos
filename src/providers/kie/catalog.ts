import type { GenerateInput, ModelSpec, SettingValue } from "../types";
import { m, s, firstUrl, urls, creditPrice, seconds, elementsFor } from "../catalog-utils";

/** 1 KIE credit = $0.005 (kie.ai/pricing). Rates below are from each model's kie.ai page, 2026-09-20. */
export const KIE_CREDIT_USD = 0.005;
const cr = (fn: (st: Record<string, SettingValue>) => number | null) => creditPrice(KIE_CREDIT_USD, (st) => fn(st));
const pick = (v: SettingValue | undefined, table: Record<string, number>, fallback: number) => (typeof v === "string" && v in table ? table[v]! : fallback);

/** A catalog entry plus the private mapping into KIE's `input` object. */
export type KieEntry = ModelSpec & {
  body: (input: GenerateInput, settings: Record<string, SettingValue>) => Record<string, unknown>;
};

const P = "kie" as const;

/** prompt + every declared setting, verbatim. */
const std = (input: GenerateInput, settings: Record<string, SettingValue>): Record<string, unknown> => ({
  prompt: input.prompt,
  ...settings,
});

const withNeg = (input: GenerateInput, body: Record<string, unknown>): Record<string, unknown> =>
  input.negativePrompt ? { ...body, negative_prompt: input.negativePrompt } : body;

const withSeed = (input: GenerateInput, body: Record<string, unknown>): Record<string, unknown> =>
  input.seed !== undefined ? { ...body, seed: input.seed } : body;

const IMG_RATIOS_BANANA = ["1:1", "9:16", "16:9", "3:4", "4:3", "3:2", "2:3", "5:4", "4:5", "21:9"];

export const KIE_CATALOG: KieEntry[] = [
  // ───────────────────────────── IMAGE ─────────────────────────────
  {
    id: "google/nano-banana",
    provider: P,
    name: "Nano Banana",
    kind: "image",
    settings: [s.enum("aspect_ratio", "Aspect", IMG_RATIOS_BANANA, "1:1"), s.enum("output_format", "Format", ["png", "jpeg"], "png")],
    media: [],
    batch: { native: false, max: 4 },
    notes: "Gemini 2.5 Flash Image. Fast, strong prompt adherence.",
    price: cr(() => 4),
    body: std,
  },
  {
    id: "google/nano-banana-edit",
    provider: P,
    name: "Nano Banana Edit",
    kind: "image",
    settings: [s.enum("aspect_ratio", "Aspect", [...IMG_RATIOS_BANANA, "auto"], "auto"), s.enum("output_format", "Format", ["png", "jpeg"], "png")],
    media: [m.reference(10, 1)],
    batch: { native: false, max: 4 },
    notes: "Edit or combine up to 10 reference images.",
    price: cr(() => 4),
    body: (i, st) => ({ ...std(i, st), image_urls: urls(i, "reference") }),
  },
  {
    id: "nano-banana-pro",
    provider: P,
    name: "Nano Banana Pro",
    kind: "image",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9", "auto"], "1:1"),
      s.enum("resolution", "Resolution", ["1K", "2K", "4K"], "1K"),
      s.enum("output_format", "Format", ["png", "jpg"], "png"),
    ],
    media: [m.reference(8)],
    batch: { native: false, max: 4 },
    notes: "Gemini 3 Pro Image. Up to 4K; optional reference images.",
    price: cr((st) => (st.resolution === "4K" ? 14 : 8)),
    body: (i, st) => {
      const refs = urls(i, "reference");
      return { ...std(i, st), ...(refs.length ? { image_input: refs } : {}) };
    },
  },
  {
    id: "nano-banana-2",
    provider: P,
    name: "Nano Banana 2",
    kind: "image",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["auto", "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"], "1:1"),
      s.enum("resolution", "Resolution", ["1K", "2K", "4K"], "1K"),
      s.enum("output_format", "Format", ["png", "jpg"], "jpg"),
    ],
    media: [m.reference(14)],
    batch: { native: false, max: 4 },
    price: cr((st) => pick(st.resolution, { "1K": 8, "2K": 12, "4K": 18 }, 8)),
    body: (i, st) => {
      const refs = urls(i, "reference");
      return { ...std(i, st), ...(refs.length ? { image_input: refs } : {}) };
    },
  },
  {
    id: "seedream/4.5-text-to-image",
    provider: P,
    name: "Seedream 4.5",
    kind: "image",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["1:1", "4:3", "3:4", "16:9", "9:16", "2:3", "3:2", "21:9"], "1:1"),
      s.enum("quality", "Quality", ["basic", "high"], "basic"),
    ],
    media: [],
    batch: { native: false, max: 4 },
    notes: "basic = 2K, high = 4K.",
    price: cr(() => 6.5),
    body: std,
  },
  {
    id: "bytedance/seedream-v4-text-to-image",
    provider: P,
    name: "Seedream 4.0",
    kind: "image",
    settings: [
      s.enum(
        "image_size",
        "Size",
        ["square", "square_hd", "portrait_4_3", "portrait_3_2", "portrait_16_9", "landscape_4_3", "landscape_3_2", "landscape_16_9", "landscape_21_9"],
        "square_hd",
      ),
      s.enum("image_resolution", "Resolution", ["1K", "2K", "4K"], "1K"),
    ],
    media: [],
    batch: { native: false, max: 4 },
    advanced: { seed: true },
    price: cr(() => 5),
    body: (i, st) => withSeed(i, { ...std(i, st), max_images: 1 }),
  },
  {
    id: "flux-2/pro-text-to-image",
    provider: P,
    name: "FLUX.2 Pro",
    kind: "image",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3"], "1:1"),
      s.enum("resolution", "Resolution", ["1K", "2K"], "1K"),
    ],
    media: [],
    batch: { native: false, max: 4 },
    price: cr((st) => (st.resolution === "2K" ? 24 : 14)),
    body: std,
  },
  {
    id: "z-image",
    provider: P,
    name: "Z-Image",
    kind: "image",
    settings: [s.enum("aspect_ratio", "Aspect", ["1:1", "4:3", "3:4", "16:9", "9:16"], "1:1")],
    media: [],
    batch: { native: false, max: 4 },
    notes: "Prompt limited to 1000 characters.",
    price: cr(() => 0.8),
    body: std,
  },
  {
    id: "qwen/text-to-image",
    provider: P,
    name: "Qwen Image",
    kind: "image",
    settings: [
      s.enum("image_size", "Size", ["square", "square_hd", "portrait_4_3", "portrait_16_9", "landscape_4_3", "landscape_16_9"], "square_hd"),
      s.number("guidance_scale", "Guidance", 0, 20, 0.5, 2.5),
      s.number("num_inference_steps", "Steps", 2, 250, 1, 30),
      s.enum("output_format", "Format", ["png", "jpeg"], "png"),
    ],
    media: [],
    batch: { native: false, max: 4 },
    advanced: { negativePrompt: true, seed: true },
    price: cr(() => 4),
    body: (i, st) => withSeed(i, withNeg(i, std(i, st))),
  },
  {
    id: "gpt-image/1.5-text-to-image",
    provider: P,
    name: "GPT Image 1.5",
    kind: "image",
    settings: [s.enum("aspect_ratio", "Aspect", ["1:1", "2:3", "3:2"], "1:1"), s.enum("quality", "Quality", ["medium", "high"], "medium")],
    media: [],
    batch: { native: false, max: 4 },
    price: cr((st) => (st.quality === "high" ? 22 : 4)),
    body: std,
  },
  {
    id: "ideogram/v3-text-to-image",
    provider: P,
    name: "Ideogram V3",
    kind: "image",
    settings: [
      s.enum("image_size", "Size", ["square", "square_hd", "portrait_4_3", "portrait_16_9", "landscape_4_3", "landscape_16_9"], "square_hd"),
      s.enum("rendering_speed", "Speed", ["TURBO", "BALANCED", "QUALITY"], "BALANCED"),
      s.enum("style", "Style", ["AUTO", "GENERAL", "REALISTIC", "DESIGN"], "AUTO"),
      s.bool("expand_prompt", "Magic prompt", true),
    ],
    media: [],
    batch: { native: false, max: 4 },
    advanced: { negativePrompt: true, seed: true },
    notes: "Strong at typography and design.",
    price: cr((st) => pick(st.rendering_speed, { TURBO: 3.5, BALANCED: 7, QUALITY: 10 }, 7)),
    body: (i, st) => withSeed(i, withNeg(i, std(i, st))),
  },
  {
    id: "google/imagen4",
    provider: P,
    name: "Imagen 4",
    kind: "image",
    settings: [s.enum("aspect_ratio", "Aspect", ["1:1", "16:9", "9:16", "3:4", "4:3"], "1:1")],
    media: [],
    batch: { native: false, max: 4 },
    advanced: { negativePrompt: true, seed: true },
    price: cr(() => 8),
    body: (i, st) => {
      const b = withNeg(i, std(i, st));
      return i.seed !== undefined ? { ...b, seed: String(i.seed) } : b;
    },
  },

  // ── GPT Image 2.5 / 2 (OpenAI via KIE) ──
  ...(["flare", "sunburst"] as const).flatMap((tier): KieEntry[] => {
    const name = tier === "flare" ? "GPT Image 2.5 Flare" : "GPT Image 2.5 Sunburst";
    const notes = tier === "flare" ? "Default tier, lower latency." : "Premium tier for polished, tightly controlled output.";
    const settings = [
      s.enum("aspect_ratio", "Aspect", ["auto", "1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16", "21:9", "27:16", "16:27", "9:8", "8:9"], "auto"),
      s.enum("resolution", "Resolution", ["1K", "2K", "4K"], "1K"),
      s.enum("background", "Background", ["auto", "opaque", "transparent"], "auto"),
    ];
    const price = cr((st) => pick(st.resolution, { "1K": 6, "2K": 10, "4K": 16 }, 6));
    return [
      {
        id: `gpt-image-2-5-${tier}-text-to-image`,
        provider: P,
        name,
        kind: "image",
        settings,
        media: [],
        batch: { native: false, max: 4 },
        notes,
        price,
        body: std,
      },
      {
        id: `gpt-image-2-5-${tier}-image-to-image`,
        provider: P,
        name: `${name} · Edit`,
        kind: "image",
        settings,
        media: [m.reference(10, 1)],
        batch: { native: false, max: 4 },
        notes,
        price,
        body: (i, st) => ({ ...std(i, st), input_urls: urls(i, "reference") }),
      },
    ];
  }),
  {
    id: "gpt-image-2-text-to-image",
    provider: P,
    name: "GPT Image 2",
    kind: "image",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["auto", "1:1", "3:2", "2:3", "4:3", "3:4", "5:4", "4:5", "16:9", "9:16", "2:1", "1:2", "3:1", "1:3", "21:9", "9:21"], "auto"),
      s.enum("resolution", "Resolution", ["1K", "2K", "4K"], "1K"),
      s.enum("background", "Background", ["auto", "opaque", "transparent"], "auto"),
    ],
    media: [],
    batch: { native: false, max: 4 },
    notes: "1:1 can't be rendered at 4K.",
    price: cr((st) => pick(st.resolution, { "1K": 6, "2K": 10, "4K": 16 }, 6)),
    body: std,
  },
  {
    id: "gpt-image-2-image-to-image",
    provider: P,
    name: "GPT Image 2 · Edit",
    kind: "image",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["auto", "1:1", "3:2", "2:3", "4:3", "3:4", "5:4", "4:5", "16:9", "9:16", "2:1", "1:2", "3:1", "1:3", "21:9", "9:21"], "auto"),
      s.enum("resolution", "Resolution", ["1K", "2K", "4K"], "1K"),
      s.enum("background", "Background", ["auto", "opaque", "transparent"], "auto"),
    ],
    media: [m.reference(10, 1)],
    batch: { native: false, max: 4 },
    price: cr((st) => pick(st.resolution, { "1K": 6, "2K": 10, "4K": 16 }, 6)),
    body: (i, st) => ({ ...std(i, st), input_urls: urls(i, "reference") }),
  },

  // ── Seedream 5 ──
  {
    id: "seedream/5-pro-text-to-image",
    provider: P,
    name: "Seedream 5.0 Pro",
    kind: "image",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["1:1", "4:3", "3:4", "16:9", "9:16", "2:3", "3:2", "21:9"], "1:1"),
      s.enum("quality", "Quality", ["basic", "high"], "basic"),
      s.enum("output_format", "Format", ["png", "jpeg"], "png"),
    ],
    media: [],
    batch: { native: false, max: 4 },
    notes: "basic = 1K, high = 2K.",
    price: cr((st) => (st.quality === "high" ? 14 : 7)),
    body: std,
  },
  {
    id: "seedream/5-pro-image-to-image",
    provider: P,
    name: "Seedream 5.0 Pro · Edit",
    kind: "image",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["1:1", "4:3", "3:4", "16:9", "9:16", "2:3", "3:2", "21:9"], "1:1"),
      s.enum("quality", "Quality", ["basic", "high"], "basic"),
      s.enum("output_format", "Format", ["png", "jpeg"], "png"),
    ],
    media: [m.reference(10, 1)],
    batch: { native: false, max: 4 },
    notes: "basic = 1K, high = 2K. Extra input images cost 0.5 cr each.",
    price: cr((st) => (st.quality === "high" ? 14 : 7)),
    body: (i, st) => ({ ...std(i, st), image_urls: urls(i, "reference") }),
  },
  {
    id: "seedream/5-lite-text-to-image",
    provider: P,
    name: "Seedream 5.0 Lite",
    kind: "image",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["1:1", "4:3", "3:4", "16:9", "9:16", "2:3", "3:2", "21:9"], "1:1"),
      s.enum("quality", "Quality", ["basic", "high", "ultra"], "basic"),
      s.enum("output_format", "Format", ["png", "jpeg"], "png"),
    ],
    media: [],
    batch: { native: false, max: 4 },
    notes: "basic = 2K, high = 3K, ultra = 4K.",
    price: cr(() => 5.5),
    body: std,
  },

  // ── More Google / xAI / Qwen / Wan ──
  {
    id: "nano-banana-2-lite",
    provider: P,
    name: "Nano Banana 2 Lite",
    kind: "image",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["auto", "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"], "1:1"),
    ],
    media: [m.reference(10)],
    batch: { native: false, max: 4 },
    price: cr(() => 4),
    body: (i, st) => {
      const refs = urls(i, "reference");
      return { ...std(i, st), ...(refs.length ? { image_urls: refs } : {}) };
    },
  },
  {
    id: "grok-imagine-image-2-0/text-to-image",
    provider: P,
    name: "Grok Imagine Image 2.0",
    kind: "image",
    settings: [s.enum("aspect_ratio", "Aspect", ["1:1", "2:3", "3:2", "16:9", "9:16"], "1:1")],
    media: [],
    batch: { native: false, max: 4 },
    price: cr(() => 4),
    body: std,
  },
  {
    id: "grok-imagine-image-2-0/image-edit",
    provider: P,
    name: "Grok Imagine Image 2.0 · Edit",
    kind: "image",
    settings: [s.enum("aspect_ratio", "Aspect", ["auto", "1:1", "2:3", "3:2", "16:9", "9:16"], "auto")],
    media: [m.reference(5, 1)],
    batch: { native: false, max: 4 },
    price: cr(() => 4),
    body: (i, st) => ({ ...std(i, st), image_urls: urls(i, "reference") }),
  },
  {
    id: "qwen3/pro-text-to-image",
    provider: P,
    name: "Qwen Image 3.0 Pro",
    kind: "image",
    settings: [
      s.enum("image_size", "Aspect", ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16", "21:9"], "16:9"),
      s.enum("resolution", "Resolution", ["1K", "2K"], "1K"),
      s.enum("output_format", "Format", ["png", "jpeg"], "png"),
      s.bool("prompt_extend", "Rewrite prompt", true),
    ],
    media: [],
    batch: { native: false, max: 4 },
    advanced: { negativePrompt: true, seed: true },
    price: cr((st) => (st.resolution === "2K" ? 12 : 6.4)),
    body: (i, st) => withSeed(i, withNeg(i, std(i, st))),
  },
  {
    id: "wan/2-7-image-pro",
    provider: P,
    name: "Wan 2.7 Image Pro",
    kind: "image",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["1:1", "16:9", "4:3", "21:9", "3:4", "9:16"], "1:1"),
      s.enum("resolution", "Resolution", ["1K", "2K", "4K"], "2K"),
    ],
    media: [m.reference(4)],
    batch: { native: false, max: 4 },
    advanced: { seed: true },
    notes: "Generation and editing in one model.",
    price: cr(() => 12),
    body: (i, st) => {
      const refs = urls(i, "reference");
      return withSeed(i, { ...std(i, st), enable_sequential: false, watermark: false, ...(refs.length ? { input_urls: refs } : {}) });
    },
  },

  // ───────────────────────────── VIDEO ─────────────────────────────
  {
    id: "veo-3-1",
    provider: P,
    name: "Veo 3.1",
    kind: "video",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["16:9", "9:16"], "16:9"),
      s.enum("resolution", "Resolution", ["720p", "1080p", "4k"], "720p"),
      s.enum("duration", "Duration", ["4", "6", "8"], "8"),
    ],
    media: [m.start(false), m.end()],
    batch: { native: false, max: 2 },
    notes: "Native audio. Start frame optional; add an end frame for a transition.",
    price: cr((st) => pick(st.resolution, { "720p": 250, "1080p": 255, "4k": 370 }, 250)),
    body: (i, st) => {
      const frames = [firstUrl(i, "start"), firstUrl(i, "end")].filter((u): u is string => !!u);
      return {
        prompt: i.prompt,
        aspect_ratio: st.aspect_ratio,
        resolution: st.resolution,
        duration: Number(st.duration),
        enable_fallback: false,
        enable_translation: true,
        ...(frames.length ? { image_urls: frames, generation_type: "FIRST_AND_LAST_FRAMES_2_VIDEO" } : { generation_type: "TEXT_2_VIDEO" }),
      };
    },
  },
  {
    id: "kling-2.6/text-to-video",
    provider: P,
    name: "Kling 2.6",
    kind: "video",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["16:9", "9:16", "1:1"], "16:9"),
      s.enum("duration", "Duration", ["5", "10"], "5"),
      s.bool("sound", "Sound", true),
    ],
    media: [],
    batch: { native: false, max: 2 },
    price: cr((st) => (seconds(st.duration, 5) >= 10 ? 110 : 55) * (st.sound ? 2 : 1)),
    body: std,
  },
  {
    id: "kling-2.6/image-to-video",
    provider: P,
    name: "Kling 2.6 · Image to video",
    kind: "video",
    settings: [s.enum("duration", "Duration", ["5", "10"], "5"), s.bool("sound", "Sound", true)],
    media: [m.start()],
    batch: { native: false, max: 2 },
    notes: "Start frame only (KIE accepts one image).",
    price: cr((st) => (seconds(st.duration, 5) >= 10 ? 110 : 55) * (st.sound ? 2 : 1)),
    body: (i, st) => ({ ...std(i, st), image_urls: urls(i, "start") }),
  },
  {
    id: "kling-3.0-omni/text-to-video",
    provider: P,
    name: "Kling 3.0 Omni",
    kind: "video",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["16:9", "9:16", "1:1"], "16:9"),
      s.enum("resolution", "Resolution", ["720p", "1080p", "4k"], "720p"),
      s.number("duration", "Duration", 3, 15, 1, 5, "s"),
      s.bool("audio", "Audio", false),
    ],
    media: [],
    batch: { native: false, max: 2 },
    price: cr((st) => seconds(st.duration, 5) * (st.resolution === "4k" ? 67 : st.audio ? 20 : 14)),
    body: (i, st) => ({ ...std(i, st), duration: Number(st.duration), customize_multi_shots: false, elements: [] }),
  },
  {
    id: "kling-3.0-omni/image-to-video",
    provider: P,
    name: "Kling 3.0 Omni · Image to video",
    kind: "video",
    settings: [
      s.enum("resolution", "Resolution", ["720p", "1080p", "4k"], "720p"),
      s.number("duration", "Duration", 3, 15, 1, 5, "s"),
      s.bool("audio", "Audio", false),
    ],
    media: [m.start(), m.end()],
    batch: { native: false, max: 2 },
    price: cr((st) => seconds(st.duration, 5) * (st.resolution === "4k" ? 67 : st.audio ? 20 : 14)),
    body: (i, st) => ({
      ...std(i, st),
      duration: Number(st.duration),
      aspect_ratio: "auto",
      customize_multi_shots: false,
      elements: [],
      image_urls: [firstUrl(i, "start"), firstUrl(i, "end")].filter((u): u is string => !!u),
    }),
  },
  {
    id: "kling/v2-5-turbo-text-to-video-pro",
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
    price: cr((st) => (seconds(st.duration, 5) >= 10 ? 84 : 42)),
    body: (i, st) => withNeg(i, std(i, st)),
  },
  {
    id: "kling/v2-5-turbo-image-to-video-pro",
    provider: P,
    name: "Kling 2.5 Turbo Pro · Image to video",
    kind: "video",
    settings: [s.enum("duration", "Duration", ["5", "10"], "5"), s.number("cfg_scale", "CFG", 0, 1, 0.1, 0.5)],
    media: [m.start(), m.end()],
    batch: { native: false, max: 2 },
    advanced: { negativePrompt: true },
    price: cr((st) => (seconds(st.duration, 5) >= 10 ? 84 : 42)),
    body: (i, st) => {
      const tail = firstUrl(i, "end");
      return withNeg(i, { ...std(i, st), image_url: firstUrl(i, "start"), ...(tail ? { tail_image_url: tail } : {}) });
    },
  },
  {
    id: "bytedance/seedance-2",
    provider: P,
    name: "Seedance 2.0",
    kind: "video",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "adaptive"], "16:9"),
      s.enum("resolution", "Resolution", ["480p", "720p", "1080p", "4k"], "720p"),
      s.number("duration", "Duration", 4, 15, 1, 5, "s"),
      s.bool("generate_audio", "Audio", true),
    ],
    media: [m.start(false), m.end(), m.reference(4)],
    batch: { native: false, max: 2 },
    price: cr((st) => seconds(st.duration, 5) * pick(st.resolution, { "480p": 19, "720p": 41, "1080p": 102, "4k": 208 }, 41)),
    body: (i, st) => {
      const first = firstUrl(i, "start");
      const last = firstUrl(i, "end");
      const refs = urls(i, "reference");
      return {
        ...std(i, st),
        duration: Number(st.duration),
        ...(first ? { first_frame_url: first } : {}),
        ...(last ? { last_frame_url: last } : {}),
        ...(refs.length ? { reference_image_urls: refs } : {}),
      };
    },
  },
  {
    id: "bytedance/seedance-1.5-pro",
    provider: P,
    name: "Seedance 1.5 Pro",
    kind: "video",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"], "16:9"),
      s.enum("resolution", "Resolution", ["480p", "720p", "1080p"], "720p"),
      s.number("duration", "Duration", 4, 12, 1, 5, "s"),
      s.bool("generate_audio", "Audio", false),
      s.bool("fixed_lens", "Lock camera", false),
    ],
    media: [m.start(false), m.end()],
    batch: { native: false, max: 2 },
    price: cr((st) => seconds(st.duration, 5) * pick(st.resolution, { "480p": 1.75, "720p": 3.5, "1080p": 7.5 }, 3.5) * (st.generate_audio ? 2 : 1)),
    body: (i, st) => {
      const frames = [firstUrl(i, "start"), firstUrl(i, "end")].filter((u): u is string => !!u);
      return { ...std(i, st), duration: Number(st.duration), ...(frames.length ? { input_urls: frames } : {}) };
    },
  },
  {
    id: "hailuo/02-text-to-video-pro",
    provider: P,
    name: "Hailuo 02 Pro",
    kind: "video",
    settings: [s.bool("prompt_optimizer", "Optimize prompt", true)],
    media: [],
    batch: { native: false, max: 2 },
    notes: "1080p, 6s.",
    price: cr(() => 9.5 * 6),
    body: std,
  },
  {
    id: "hailuo/2-3-image-to-video-pro",
    provider: P,
    name: "Hailuo 2.3 Pro · Image to video",
    kind: "video",
    settings: [s.enum("duration", "Duration", ["6", "10"], "6"), s.enum("resolution", "Resolution", ["768P", "1080P"], "768P")],
    media: [m.start()],
    batch: { native: false, max: 2 },
    notes: "10s not available at 1080P.",
    price: cr((st) => (st.resolution === "1080P" ? 80 : seconds(st.duration, 6) >= 10 ? 90 : 45)),
    body: (i, st) => ({ ...std(i, st), image_url: firstUrl(i, "start") }),
  },
  {
    id: "wan/2-6-text-to-video",
    provider: P,
    name: "Wan 2.6",
    kind: "video",
    settings: [
      s.enum("duration", "Duration", ["5", "10", "15"], "5"),
      s.enum("resolution", "Resolution", ["720p", "1080p"], "1080p"),
      s.bool("multi_shots", "Multi-shot", false),
    ],
    media: [],
    batch: { native: false, max: 2 },
    price: cr((st) => (st.resolution === "720p" ? pick(st.duration, { "5": 70, "10": 140, "15": 209.5 }, 70) : pick(st.duration, { "5": 104.5, "10": 209.5, "15": 315 }, 104.5))),
    body: std,
  },
  {
    id: "wan/2-6-image-to-video",
    provider: P,
    name: "Wan 2.6 · Image to video",
    kind: "video",
    settings: [
      s.enum("duration", "Duration", ["5", "10", "15"], "5"),
      s.enum("resolution", "Resolution", ["720p", "1080p"], "1080p"),
      s.bool("multi_shots", "Multi-shot", false),
    ],
    media: [m.start()],
    batch: { native: false, max: 2 },
    price: cr((st) => (st.resolution === "720p" ? pick(st.duration, { "5": 70, "10": 140, "15": 209.5 }, 70) : pick(st.duration, { "5": 104.5, "10": 209.5, "15": 315 }, 104.5))),
    body: (i, st) => ({ ...std(i, st), image_urls: urls(i, "start") }),
  },
  {
    id: "grok-imagine/text-to-video",
    provider: P,
    name: "Grok Imagine",
    kind: "video",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["16:9", "9:16", "1:1", "3:2", "2:3"], "16:9"),
      s.enum("resolution", "Resolution", ["480p", "720p", "1080p"], "720p"),
      s.number("duration", "Duration", 6, 30, 1, 6, "s"),
      s.enum("mode", "Mode", ["normal", "fun", "spicy"], "normal"),
    ],
    media: [],
    batch: { native: false, max: 2 },
    price: cr((st) => seconds(st.duration, 6) * pick(st.resolution, { "480p": 2.4, "720p": 4.5, "1080p": 8 }, 4.5)),
    body: (i, st) => ({ ...std(i, st), duration: Number(st.duration) }),
  },
  {
    id: "grok-imagine/image-to-video",
    provider: P,
    name: "Grok Imagine · Image to video",
    kind: "video",
    settings: [
      s.enum("resolution", "Resolution", ["480p", "720p", "1080p"], "720p"),
      s.number("duration", "Duration", 6, 30, 1, 6, "s"),
      s.enum("mode", "Mode", ["normal", "fun"], "normal"),
    ],
    media: [m.reference(7, 1)],
    batch: { native: false, max: 2 },
    price: cr((st) => seconds(st.duration, 6) * pick(st.resolution, { "480p": 2.4, "720p": 4.5, "1080p": 8 }, 4.5)),
    promptRefs: "at-image",
    body: (i, st) => ({ ...std(i, st), duration: String(st.duration), image_urls: urls(i, "reference") }),
  },
  {
    id: "pixverse-v6/text-to-video",
    provider: P,
    name: "PixVerse V6",
    kind: "video",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["16:9", "9:16", "1:1", "4:3", "3:4", "2:3", "3:2", "21:9"], "16:9"),
      s.enum("quality", "Quality", ["360p", "540p", "720p", "1080p"], "720p"),
      s.number("duration", "Duration", 1, 15, 1, 5, "s"),
      s.bool("generate_audio_switch", "Audio", false),
    ],
    media: [],
    batch: { native: false, max: 2 },
    advanced: { seed: true },
    price: cr((st) => seconds(st.duration, 5) * (st.generate_audio_switch ? pick(st.quality, { "360p": 5.6, "540p": 7.2, "720p": 9.6, "1080p": 18.4 }, 9.6) : pick(st.quality, { "360p": 4, "540p": 5.6, "720p": 7.2, "1080p": 14.4 }, 7.2))),
    body: (i, st) => withSeed(i, { ...std(i, st), duration: Number(st.duration) }),
  },
  // ───────────────────────── MORE VIDEO (KIE market, 2026-09) ─────────────────────────
  {
    id: "bytedance/seedance-2-5",
    provider: P,
    name: "Seedance 2.5",
    kind: "video",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "adaptive"], "16:9"),
      s.enum("resolution", "Resolution", ["480p", "720p", "1080p"], "720p"),
      s.number("duration", "Duration", 4, 30, 1, 5, "s"),
      s.bool("generate_audio", "Audio", true),
    ],
    media: [m.start(false), m.end(), m.reference(4)],
    batch: { native: false, max: 2 },
    notes: "Up to 30 s.",
    price: cr((st) => seconds(st.duration, 5) * pick(st.resolution, { "480p": 28, "720p": 63, "1080p": 158 }, 63)),
    body: (i, st) => {
      const first = firstUrl(i, "start");
      const last = firstUrl(i, "end");
      const refs = urls(i, "reference");
      return {
        ...std(i, st),
        duration: Number(st.duration),
        output_format: "mp4",
        ...(first ? { first_frame_url: first } : {}),
        ...(last ? { last_frame_url: last } : {}),
        ...(refs.length ? { reference_image_urls: refs } : {}),
      };
    },
  },
  ...(["fast", "mini"] as const).map((tier): KieEntry => ({
    id: `bytedance/seedance-2-${tier}`,
    provider: P,
    name: tier === "fast" ? "Seedance 2.0 Fast" : "Seedance 2.0 Mini",
    kind: "video",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "adaptive"], "16:9"),
      s.enum("resolution", "Resolution", ["480p", "720p"], "720p"),
      s.number("duration", "Duration", 4, 15, 1, 5, "s"),
      s.bool("generate_audio", "Audio", true),
    ],
    media: [m.start(false), m.end(), m.reference(4)],
    batch: { native: false, max: 2 },
    price: cr((st) =>
      seconds(st.duration, 5) *
      (tier === "fast" ? pick(st.resolution, { "480p": 11.7, "720p": 24.8 }, 24.8) : pick(st.resolution, { "480p": 3.8, "720p": 8.2 }, 8.2)),
    ),
    body: (i, st) => {
      const first = firstUrl(i, "start");
      const last = firstUrl(i, "end");
      const refs = urls(i, "reference");
      return {
        ...std(i, st),
        duration: Number(st.duration),
        ...(first ? { first_frame_url: first } : {}),
        ...(last ? { last_frame_url: last } : {}),
        ...(refs.length ? { reference_image_urls: refs } : {}),
      };
    },
  })),
  {
    id: "kling-3.0/video",
    provider: P,
    name: "Kling 3.0",
    kind: "video",
    settings: [
      s.enum("mode", "Mode", ["std", "pro", "4K"], "pro"),
      s.enum("aspect_ratio", "Aspect", ["16:9", "9:16", "1:1"], "16:9"),
      s.enum("duration", "Duration", ["3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15"], "5"),
      s.bool("sound", "Sound", false),
    ],
    media: [m.start(false), m.end(), m.reference(4)],
    batch: { native: false, max: 2 },
    notes: "std / pro / 4K; optional first + last frame; references become @image1… subjects.",
    promptRefs: "elements",
    price: cr((st) => seconds(st.duration, 5) * (st.mode === "4K" ? 67 : st.mode === "pro" ? (st.sound ? 27 : 18) : st.sound ? 20 : 14)),
    body: (i, st) => {
      const frames = [firstUrl(i, "start"), firstUrl(i, "end")].filter((u): u is string => !!u);
      const refs = urls(i, "reference");
      return {
        ...std(i, st),
        multi_shots: false,
        multi_prompt: [],
        ...(frames.length ? { image_urls: frames } : {}),
        ...(refs.length ? { kling_elements: elementsFor(refs) } : {}),
      };
    },
  },
  {
    id: "kling/v3-turbo-text-to-video",
    provider: P,
    name: "Kling 3.0 Turbo",
    kind: "video",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["16:9", "9:16", "1:1"], "16:9"),
      s.enum("resolution", "Resolution", ["720p", "1080p"], "720p"),
      s.number("duration", "Duration", 3, 15, 1, 5, "s"),
    ],
    media: [],
    batch: { native: false, max: 2 },
    price: cr((st) => seconds(st.duration, 5) * (st.resolution === "1080p" ? 22.5 : 18)),
    body: (i, st) => ({ ...std(i, st), duration: String(st.duration) }),
  },
  {
    id: "kling/v3-turbo-image-to-video",
    provider: P,
    name: "Kling 3.0 Turbo · Image to video",
    kind: "video",
    settings: [s.enum("resolution", "Resolution", ["720p", "1080p"], "720p"), s.number("duration", "Duration", 3, 15, 1, 5, "s")],
    media: [m.start()],
    batch: { native: false, max: 2 },
    notes: "Start frame only (KIE accepts one image). For first + last frame use Kling 3.0 or 3.0 Omni.",
    price: cr((st) => seconds(st.duration, 5) * (st.resolution === "1080p" ? 22.5 : 18)),
    body: (i, st) => ({ ...std(i, st), duration: String(st.duration), image_urls: urls(i, "start") }),
  },
  {
    id: "kling/v2-1-master-text-to-video",
    provider: P,
    name: "Kling 2.1 Master",
    kind: "video",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["16:9", "9:16", "1:1"], "16:9"),
      s.enum("duration", "Duration", ["5", "10"], "5"),
      s.number("cfg_scale", "CFG", 0, 1, 0.1, 0.5),
    ],
    media: [],
    batch: { native: false, max: 2 },
    advanced: { negativePrompt: true },
    price: cr((st) => (seconds(st.duration, 5) >= 10 ? 320 : 160)),
    body: (i, st) => withNeg(i, std(i, st)),
  },
  {
    id: "kling/v2-1-master-image-to-video",
    provider: P,
    name: "Kling 2.1 Master · Image to video",
    kind: "video",
    settings: [s.enum("duration", "Duration", ["5", "10"], "5"), s.number("cfg_scale", "CFG", 0, 1, 0.1, 0.5)],
    media: [m.start()],
    batch: { native: false, max: 2 },
    advanced: { negativePrompt: true },
    price: cr((st) => (seconds(st.duration, 5) >= 10 ? 320 : 160)),
    body: (i, st) => withNeg(i, { ...std(i, st), image_url: firstUrl(i, "start") }),
  },
  {
    id: "kling/v2-1-pro",
    provider: P,
    name: "Kling 2.1 Pro · Image to video",
    kind: "video",
    settings: [s.enum("duration", "Duration", ["5", "10"], "5"), s.number("cfg_scale", "CFG", 0, 1, 0.1, 0.5)],
    media: [m.start(), m.end()],
    batch: { native: false, max: 2 },
    advanced: { negativePrompt: true },
    price: cr((st) => (seconds(st.duration, 5) >= 10 ? 100 : 50)),
    body: (i, st) => {
      const tail = firstUrl(i, "end");
      return withNeg(i, { ...std(i, st), image_url: firstUrl(i, "start"), ...(tail ? { tail_image_url: tail } : {}) });
    },
  },
  {
    id: "kling/v2-1-standard",
    provider: P,
    name: "Kling 2.1 Standard · Image to video",
    kind: "video",
    settings: [s.enum("duration", "Duration", ["5", "10"], "5"), s.number("cfg_scale", "CFG", 0, 1, 0.1, 0.5)],
    media: [m.start()],
    batch: { native: false, max: 2 },
    advanced: { negativePrompt: true },
    price: cr((st) => (seconds(st.duration, 5) >= 10 ? 50 : 25)),
    body: (i, st) => withNeg(i, { ...std(i, st), image_url: firstUrl(i, "start") }),
  },
  ...(["", "-prime"] as const).map((suffix): KieEntry => ({
    id: `wan/3-0-video${suffix}`,
    provider: P,
    name: suffix ? "Wan 3.0 Prime" : "Wan 3.0",
    kind: "video",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["adaptive", "16:9", "9:16", "1:1", "4:3", "3:4"], "16:9"),
      s.enum("resolution", "Resolution", ["480P", "720P", "1080P"], "1080P"),
      s.number("duration", "Duration", 2, 30, 1, 5, "s"),
      s.bool("audio", "Audio", true),
    ],
    media: [m.start(false), m.reference(10)],
    batch: { native: false, max: 2 },
    advanced: { seed: true },
    notes: suffix ? "Higher-fidelity tier." : "Multimodal: text, first frame, reference images.",
    promptRefs: "ImageN",
    price: cr((st) =>
      seconds(st.duration, 5) *
      (suffix ? pick(st.resolution, { "480P": 12.2, "720P": 25.2, "1080P": 50.4 }, 50.4) : pick(st.resolution, { "480P": 8, "720P": 16, "1080P": 32 }, 32)),
    ),
    body: (i, st) => {
      const first = firstUrl(i, "start");
      const refs = urls(i, "reference");
      return withSeed(i, {
        ...std(i, st),
        duration: Number(st.duration),
        ...(first ? { first_frame_url: first } : {}),
        ...(refs.length ? { reference_image_urls: refs } : {}),
      });
    },
  })),
  {
    id: "wan/2-7-text-to-video",
    provider: P,
    name: "Wan 2.7",
    kind: "video",
    settings: [
      s.enum("ratio", "Aspect", ["16:9", "9:16", "1:1", "4:3", "3:4"], "16:9"),
      s.enum("resolution", "Resolution", ["720p", "1080p"], "1080p"),
      s.number("duration", "Duration", 2, 15, 1, 5, "s"),
      s.bool("prompt_extend", "Rewrite prompt", true),
    ],
    media: [],
    batch: { native: false, max: 2 },
    advanced: { negativePrompt: true, seed: true },
    price: cr((st) => seconds(st.duration, 5) * (st.resolution === "1080p" ? 24 : 16)),
    body: (i, st) => withSeed(i, withNeg(i, { ...std(i, st), duration: Number(st.duration), watermark: false })),
  },
  {
    id: "wan/2-7-image-to-video",
    provider: P,
    name: "Wan 2.7 · Image to video",
    kind: "video",
    settings: [
      s.enum("resolution", "Resolution", ["720p", "1080p"], "1080p"),
      s.number("duration", "Duration", 2, 15, 1, 5, "s"),
      s.bool("prompt_extend", "Rewrite prompt", true),
    ],
    media: [m.start(), m.end()],
    batch: { native: false, max: 2 },
    advanced: { negativePrompt: true, seed: true },
    price: cr((st) => seconds(st.duration, 5) * (st.resolution === "1080p" ? 24 : 16)),
    body: (i, st) => {
      const last = firstUrl(i, "end");
      return withSeed(i, withNeg(i, { ...std(i, st), duration: Number(st.duration), watermark: false, first_frame_url: firstUrl(i, "start"), ...(last ? { last_frame_url: last } : {}) }));
    },
  },
  {
    id: "wan/2-6-flash-image-to-video",
    provider: P,
    name: "Wan 2.6 Flash · Image to video",
    kind: "video",
    settings: [
      s.enum("duration", "Duration", ["5", "10", "15"], "5"),
      s.enum("resolution", "Resolution", ["720p", "1080p"], "1080p"),
      s.bool("audio", "Audio", true),
      s.bool("multi_shots", "Multi-shot", false),
    ],
    media: [m.start()],
    batch: { native: false, max: 2 },
    notes: "Rate assumed equal to Wan 2.6 until observed.",
    price: cr((st) => (st.resolution === "720p" ? pick(st.duration, { "5": 70, "10": 140, "15": 209.5 }, 70) : pick(st.duration, { "5": 104.5, "10": 209.5, "15": 315 }, 104.5))),
    body: (i, st) => ({ ...std(i, st), image_urls: urls(i, "start") }),
  },
  {
    id: "wan/2-5-text-to-video",
    provider: P,
    name: "Wan 2.5",
    kind: "video",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["16:9", "9:16", "1:1"], "16:9"),
      s.enum("resolution", "Resolution", ["720p", "1080p"], "1080p"),
      s.enum("duration", "Duration", ["5", "10"], "5"),
      s.bool("enable_prompt_expansion", "Rewrite prompt", false),
    ],
    media: [],
    batch: { native: false, max: 2 },
    advanced: { negativePrompt: true, seed: true },
    price: cr((st) => seconds(st.duration, 5) * (st.resolution === "1080p" ? 20 : 12)),
    body: (i, st) => withSeed(i, withNeg(i, std(i, st))),
  },
  {
    id: "wan/2-5-image-to-video",
    provider: P,
    name: "Wan 2.5 · Image to video",
    kind: "video",
    settings: [
      s.enum("resolution", "Resolution", ["720p", "1080p"], "1080p"),
      s.enum("duration", "Duration", ["5", "10"], "5"),
      s.bool("enable_prompt_expansion", "Rewrite prompt", false),
    ],
    media: [m.start()],
    batch: { native: false, max: 2 },
    advanced: { negativePrompt: true, seed: true },
    price: cr((st) => seconds(st.duration, 5) * (st.resolution === "1080p" ? 20 : 12)),
    body: (i, st) => withSeed(i, withNeg(i, { ...std(i, st), image_url: firstUrl(i, "start") })),
  },
  {
    id: "wan/2-2-a14b-text-to-video-turbo",
    provider: P,
    name: "Wan 2.2 A14B Turbo",
    kind: "video",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["16:9", "9:16"], "16:9"),
      s.enum("resolution", "Resolution", ["480p", "720p"], "720p"),
      s.enum("acceleration", "Speed", ["none", "regular"], "none"),
    ],
    media: [],
    batch: { native: false, max: 2 },
    advanced: { seed: true },
    notes: "5 s clips.",
    price: cr((st) => (st.resolution === "480p" ? 8 : 16) * 5),
    body: (i, st) => withSeed(i, std(i, st)),
  },
  {
    id: "wan/2-2-a14b-image-to-video-turbo",
    provider: P,
    name: "Wan 2.2 A14B Turbo · Image to video",
    kind: "video",
    settings: [s.enum("resolution", "Resolution", ["480p", "720p"], "720p"), s.enum("acceleration", "Speed", ["none", "regular"], "none")],
    media: [m.start()],
    batch: { native: false, max: 2 },
    advanced: { seed: true },
    price: cr((st) => (st.resolution === "480p" ? 8 : 16) * 5),
    body: (i, st) => withSeed(i, { ...std(i, st), image_url: firstUrl(i, "start") }),
  },
  {
    id: "minimax-h3/text-to-video",
    provider: P,
    name: "Hailuo 03 (MiniMax H3)",
    kind: "video",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"], "16:9"),
      s.enum("resolution", "Resolution", ["768P", "2K"], "2K"),
      s.number("duration", "Duration", 4, 15, 1, 6, "s"),
    ],
    media: [],
    batch: { native: false, max: 2 },
    price: cr((st) => seconds(st.duration, 6) * (st.resolution === "2K" ? 13 : 8)),
    body: (i, st) => ({ ...std(i, st), duration: Number(st.duration) }),
  },
  {
    id: "minimax-h3/image-to-video",
    provider: P,
    name: "Hailuo 03 (MiniMax H3) · Image to video",
    kind: "video",
    settings: [s.enum("resolution", "Resolution", ["768P", "2K"], "2K"), s.number("duration", "Duration", 4, 15, 1, 6, "s")],
    media: [m.start(), m.end()],
    batch: { native: false, max: 2 },
    price: cr((st) => seconds(st.duration, 6) * (st.resolution === "2K" ? 13 : 8)),
    body: (i, st) => {
      const last = firstUrl(i, "end");
      return { ...std(i, st), duration: Number(st.duration), first_frame_url: firstUrl(i, "start"), ...(last ? { last_frame_url: last } : {}) };
    },
  },
  {
    id: "hailuo/2-3-image-to-video-standard",
    provider: P,
    name: "Hailuo 2.3 Standard · Image to video",
    kind: "video",
    settings: [s.enum("duration", "Duration", ["6", "10"], "6"), s.enum("resolution", "Resolution", ["768P", "1080P"], "768P")],
    media: [m.start()],
    batch: { native: false, max: 2 },
    price: cr((st) => (st.resolution === "1080P" ? 50 : seconds(st.duration, 6) >= 10 ? 50 : 30)),
    body: (i, st) => ({ ...std(i, st), image_url: firstUrl(i, "start") }),
  },
  {
    id: "hailuo/02-image-to-video-pro",
    provider: P,
    name: "Hailuo 02 Pro · Image to video",
    kind: "video",
    settings: [s.bool("prompt_optimizer", "Optimize prompt", true)],
    media: [m.start(), m.end()],
    batch: { native: false, max: 2 },
    notes: "1080p, 6 s.",
    price: cr(() => 9.5 * 6),
    body: (i, st) => {
      const last = firstUrl(i, "end");
      return { ...std(i, st), image_url: firstUrl(i, "start"), ...(last ? { end_image_url: last } : {}) };
    },
  },
  {
    id: "hailuo/02-text-to-video-standard",
    provider: P,
    name: "Hailuo 02 Standard",
    kind: "video",
    settings: [s.enum("duration", "Duration", ["6", "10"], "6"), s.bool("prompt_optimizer", "Optimize prompt", true)],
    media: [],
    batch: { native: false, max: 2 },
    notes: "768p.",
    price: cr((st) => 5 * seconds(st.duration, 6)),
    body: std,
  },
  {
    id: "hailuo/02-image-to-video-standard",
    provider: P,
    name: "Hailuo 02 Standard · Image to video",
    kind: "video",
    settings: [
      s.enum("duration", "Duration", ["6", "10"], "6"),
      s.enum("resolution", "Resolution", ["512P", "768P"], "768P"),
      s.bool("prompt_optimizer", "Optimize prompt", true),
    ],
    media: [m.start(), m.end()],
    batch: { native: false, max: 2 },
    price: cr((st) => (st.resolution === "512P" ? 2 : 5) * seconds(st.duration, 6)),
    body: (i, st) => {
      const last = firstUrl(i, "end");
      return { ...std(i, st), image_url: firstUrl(i, "start"), ...(last ? { end_image_url: last } : {}) };
    },
  },
  {
    id: "grok-imagine-video-1-5-preview",
    provider: P,
    name: "Grok Imagine Video 1.5",
    kind: "video",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["auto", "16:9", "9:16", "1:1", "3:2", "2:3"], "16:9"),
      s.enum("resolution", "Resolution", ["480p", "720p", "1080p"], "720p"),
      s.number("duration", "Duration", 1, 15, 1, 8, "s"),
    ],
    media: [m.reference(7)],
    batch: { native: false, max: 2 },
    price: cr((st) => seconds(st.duration, 8) * pick(st.resolution, { "480p": 2.4, "720p": 4.5, "1080p": 8 }, 4.5)),
    promptRefs: "at-image",
    body: (i, st) => {
      const refs = urls(i, "reference");
      return { ...std(i, st), duration: Number(st.duration), ...(refs.length ? { image_urls: refs } : {}) };
    },
  },
  {
    id: "pixverse-v6/image-to-video",
    provider: P,
    name: "PixVerse V6 · Image to video",
    kind: "video",
    settings: [
      s.enum("quality", "Quality", ["360p", "540p", "720p", "1080p"], "720p"),
      s.number("duration", "Duration", 1, 15, 1, 5, "s"),
      s.bool("generate_audio_switch", "Audio", false),
    ],
    media: [m.start(), m.end()],
    batch: { native: false, max: 2 },
    advanced: { seed: true },
    price: cr((st) =>
      seconds(st.duration, 5) *
      (st.generate_audio_switch ? pick(st.quality, { "360p": 5.6, "540p": 7.2, "720p": 9.6, "1080p": 18.4 }, 9.6) : pick(st.quality, { "360p": 4, "540p": 5.6, "720p": 7.2, "1080p": 14.4 }, 7.2)),
    ),
    body: (i, st) =>
      withSeed(i, { ...std(i, st), duration: Number(st.duration), image_urls: [firstUrl(i, "start"), firstUrl(i, "end")].filter((u): u is string => !!u) }),
  },
  {
    id: "happyhorse-1-1/text-to-video",
    provider: P,
    name: "HappyHorse 1.1",
    kind: "video",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["16:9", "9:16", "1:1", "4:3", "3:4", "4:5", "5:4", "9:21", "21:9"], "16:9"),
      s.enum("resolution", "Resolution", ["720p", "1080p"], "1080p"),
      s.number("duration", "Duration", 3, 15, 1, 5, "s"),
    ],
    media: [],
    batch: { native: false, max: 2 },
    price: cr((st) => seconds(st.duration, 5) * (st.resolution === "1080p" ? 29 : 22.5)),
    body: (i, st) => ({ ...std(i, st), duration: Number(st.duration) }),
  },
  {
    id: "happyhorse-1-1/image-to-video",
    provider: P,
    name: "HappyHorse 1.1 · Image to video",
    kind: "video",
    settings: [s.enum("resolution", "Resolution", ["720p", "1080p"], "1080p"), s.number("duration", "Duration", 3, 15, 1, 5, "s")],
    media: [m.start()],
    batch: { native: false, max: 2 },
    price: cr((st) => seconds(st.duration, 5) * (st.resolution === "1080p" ? 29 : 22.5)),
    body: (i, st) => ({ ...std(i, st), duration: Number(st.duration), image_urls: urls(i, "start") }),
  },
  {
    id: "happyhorse/text-to-video",
    provider: P,
    name: "HappyHorse 1.0",
    kind: "video",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["16:9", "9:16", "1:1", "4:3", "3:4"], "16:9"),
      s.enum("resolution", "Resolution", ["720p", "1080p"], "1080p"),
      s.number("duration", "Duration", 3, 15, 1, 5, "s"),
    ],
    media: [],
    batch: { native: false, max: 2 },
    advanced: { seed: true },
    price: cr((st) => seconds(st.duration, 5) * (st.resolution === "1080p" ? 48 : 28)),
    body: (i, st) => withSeed(i, { ...std(i, st), duration: Number(st.duration) }),
  },
  ...(["google/gemini-omni-flash-1-1", "gemini-omni-video"] as const).map((id): KieEntry => ({
    id,
    provider: P,
    name: id === "gemini-omni-video" ? "Gemini Omni" : "Gemini Omni 1.1 Flash",
    kind: "video",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["16:9", "9:16"], "16:9"),
      s.enum("resolution", "Resolution", id === "gemini-omni-video" ? ["720p", "1080p", "4k"] : ["360p", "720p", "1080p", "4k"], "720p"),
      s.enum("duration", "Duration", ["4", "6", "8", "10"], "8"),
    ],
    media: [m.reference(6)],
    batch: { native: false, max: 2 },
    advanced: { seed: true },
    notes: "Google's Gemini video model; reference images optional.",
    price: cr((st) => pick(st.duration, { "4": 63, "6": 84, "8": 105, "10": 126 }, 105) * (st.resolution === "4k" ? 147 / 63 : 1)),
    body: (i, st) => {
      const refs = urls(i, "reference");
      return withSeed(i, { ...std(i, st), ...(refs.length ? { image_urls: refs } : {}) });
    },
  })),
  {
    id: "bytedance/v1-pro-text-to-video",
    provider: P,
    name: "Seedance 1.0 Pro",
    kind: "video",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"], "16:9"),
      s.enum("resolution", "Resolution", ["480p", "720p", "1080p"], "720p"),
      s.enum("duration", "Duration", ["5", "10"], "5"),
      s.bool("camera_fixed", "Lock camera", false),
    ],
    media: [],
    batch: { native: false, max: 2 },
    advanced: { seed: true },
    price: cr((st) => seconds(st.duration, 5) * pick(st.resolution, { "480p": 2.8, "720p": 6, "1080p": 14 }, 6)),
    body: (i, st) => withSeed(i, std(i, st)),
  },
  {
    id: "bytedance/v1-pro-image-to-video",
    provider: P,
    name: "Seedance 1.0 Pro · Image to video",
    kind: "video",
    settings: [
      s.enum("resolution", "Resolution", ["480p", "720p", "1080p"], "720p"),
      s.enum("duration", "Duration", ["5", "10"], "5"),
      s.bool("camera_fixed", "Lock camera", false),
    ],
    media: [m.start()],
    batch: { native: false, max: 2 },
    advanced: { seed: true },
    price: cr((st) => seconds(st.duration, 5) * pick(st.resolution, { "480p": 2.8, "720p": 6, "1080p": 14 }, 6)),
    body: (i, st) => withSeed(i, { ...std(i, st), image_url: firstUrl(i, "start") }),
  },
  {
    id: "bytedance/v1-lite-text-to-video",
    provider: P,
    name: "Seedance 1.0 Lite",
    kind: "video",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["16:9", "9:16", "1:1", "4:3", "3:4", "9:21"], "16:9"),
      s.enum("resolution", "Resolution", ["480p", "720p", "1080p"], "720p"),
      s.enum("duration", "Duration", ["5", "10"], "5"),
      s.bool("camera_fixed", "Lock camera", false),
    ],
    media: [],
    batch: { native: false, max: 2 },
    advanced: { seed: true },
    price: cr((st) => seconds(st.duration, 5) * pick(st.resolution, { "480p": 2, "720p": 4.5, "1080p": 10 }, 4.5)),
    body: (i, st) => withSeed(i, std(i, st)),
  },
  {
    id: "bytedance/v1-lite-image-to-video",
    provider: P,
    name: "Seedance 1.0 Lite · Image to video",
    kind: "video",
    settings: [
      s.enum("resolution", "Resolution", ["480p", "720p", "1080p"], "720p"),
      s.enum("duration", "Duration", ["5", "10"], "5"),
      s.bool("camera_fixed", "Lock camera", false),
    ],
    media: [m.start(), m.end()],
    batch: { native: false, max: 2 },
    advanced: { seed: true },
    price: cr((st) => seconds(st.duration, 5) * pick(st.resolution, { "480p": 2, "720p": 4.5, "1080p": 10 }, 4.5)),
    body: (i, st) => {
      const last = firstUrl(i, "end");
      return withSeed(i, { ...std(i, st), image_url: firstUrl(i, "start"), ...(last ? { end_image_url: last } : {}) });
    },
  },
];
