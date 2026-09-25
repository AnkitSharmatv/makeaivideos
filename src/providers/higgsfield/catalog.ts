import type { GenerateInput, ModelSpec, SettingValue } from "../types";
import { m, s, firstUrl, urls, usdPrice, seconds } from "../catalog-utils";

/** Rates from open.higgsfield.ai/explore (catalog API), 2026-09-21. `sec` = per-second video rate. */
const sec = (usdPerSecond: number, fallback: number) => usdPrice((st) => usdPerSecond * seconds(st.duration, fallback));
const perImage = (usd: number) => usdPrice((_st, count) => usd * count);

export type HiggsfieldEntry = ModelSpec & {
  body: (input: GenerateInput, settings: Record<string, SettingValue>, count: number) => Record<string, unknown>;
};

const P = "higgsfield" as const;

const std = (input: GenerateInput, settings: Record<string, SettingValue>): Record<string, unknown> => ({
  prompt: input.prompt,
  ...settings,
});
const withNeg = (input: GenerateInput, body: Record<string, unknown>): Record<string, unknown> =>
  input.negativePrompt ? { ...body, negative_prompt: input.negativePrompt } : body;
const withSeed = (input: GenerateInput, body: Record<string, unknown>): Record<string, unknown> =>
  input.seed !== undefined ? { ...body, seed: input.seed } : body;

export const HIGGSFIELD_CATALOG: HiggsfieldEntry[] = [
  // ───────────────────────────── IMAGE ─────────────────────────────
  {
    id: "higgsfield-ai/soul/v2/standard",
    provider: P,
    name: "SOUL 2",
    kind: "image",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3"], "3:4"),
      s.enum("resolution", "Resolution", ["720p", "1080p"], "1080p"),
      s.bool("enhance_prompt", "Enhance prompt", true),
    ],
    media: [],
    batch: { native: true, max: 4 },
    advanced: { seed: true },
    notes: "batch_size is 1 or 4.",
    body: (i, st, n) => withSeed(i, { ...std(i, st), batch_size: n >= 4 ? 4 : 1 }),
  },
  {
    id: "higgsfield-ai/soul/standard",
    provider: P,
    name: "SOUL",
    kind: "image",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3"], "4:3"),
      s.enum("resolution", "Resolution", ["720p", "1080p"], "1080p"),
      s.bool("enhance_prompt", "Enhance prompt", true),
    ],
    media: [],
    batch: { native: true, max: 4 },
    advanced: { seed: true },
    body: (i, st, n) => withSeed(i, { ...std(i, st), batch_size: n >= 4 ? 4 : 1 }),
  },
  {
    id: "xai/grok-imagine-image-2.0",
    provider: P,
    name: "Grok Image 2.0",
    kind: "image",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["auto", "1:1", "1:2", "2:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16"], "1:1"),
      s.enum("resolution", "Resolution", ["1k", "2k"], "1k"),
      s.enum("quality", "Quality", ["low", "medium"], "medium"),
    ],
    media: [m.reference(10)],
    batch: { native: false, max: 4 },
    body: (i, st) => {
      const refs = urls(i, "reference");
      return { ...std(i, st), ...(refs.length ? { image_urls: refs } : {}) };
    },
  },
  {
    id: "recraft/v4.1/pro/text-to-image",
    provider: P,
    name: "Recraft V4.1 Pro",
    kind: "image",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["1:1", "2:1", "1:2", "3:2", "2:3", "4:3", "3:4", "5:4", "4:5", "16:9", "9:16"], "1:1"),
      s.enum("output_format", "Format", ["png", "jpg", "webp"], "png"),
    ],
    media: [],
    batch: { native: false, max: 4 },
    body: (i, st) => ({ ...std(i, st), resolution: "2k" }),
  },

  // ───────────────────────── MORE IMAGE (explore catalog, 2026-09) ─────────────────────────
  {
    id: "ideogram/v4.0",
    provider: P,
    name: "Ideogram 4.0",
    kind: "image",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "1:2", "2:1", "1:3", "3:1", "5:8", "8:5", "3:8", "8:3", "9:22", "22:9"], "1:1"),
      s.enum("rendering_speed", "Speed", ["TURBO", "DEFAULT", "QUALITY"], "DEFAULT"),
      s.number("image_weight", "Image weight", 1, 100, 5, 50),
    ],
    media: [m.reference(1)],
    batch: { native: false, max: 4 },
    notes: "Typography-strong. Optional reference image with adjustable weight.",
    price: perImage(0.03),
    body: (i, st) => {
      const ref = firstUrl(i, "reference");
      const { image_weight, ...rest } = st;
      return { ...std(i, rest), ...(ref ? { image_url: ref, image_weight } : {}) };
    },
  },
  {
    id: "alibaba/qwen-image-3/text-to-image",
    provider: P,
    name: "Qwen Image 3",
    kind: "image",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["1:1", "2:3", "3:2", "3:4", "4:3", "7:9", "9:7", "9:16", "16:9", "21:9"], "1:1"),
      s.enum("resolution", "Resolution", ["1k", "2k"], "1k"),
      s.bool("prompt_extend", "Rewrite prompt", true),
      s.bool("enable_thinking", "Thinking", true),
    ],
    media: [],
    batch: { native: false, max: 4 },
    advanced: { negativePrompt: true, seed: true },
    price: perImage(0.04),
    body: (i, st) => withSeed(i, withNeg(i, std(i, st))),
  },
  {
    id: "z-image/turbo",
    provider: P,
    name: "Z-Image Turbo",
    kind: "image",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["1:1", "2:3", "3:2", "3:4", "4:3", "7:9", "9:7", "9:16", "16:9", "21:9"], "1:1"),
      s.enum("resolution", "Resolution", ["1k", "2k"], "1k"),
      s.bool("prompt_extend", "Rewrite prompt", false),
    ],
    media: [],
    batch: { native: false, max: 4 },
    advanced: { seed: true },
    price: perImage(0.015),
    body: (i, st) => withSeed(i, std(i, st)),
  },
  {
    id: "marketing-studio/image",
    provider: P,
    name: "Marketing Studio Image",
    kind: "image",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["auto", "1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16", "21:9"], "auto"),
      s.enum("resolution", "Resolution", ["1k", "2k", "4k"], "2k"),
      s.enum("quality", "Quality", ["low", "medium", "high"], "high"),
      s.bool("enhance_prompt", "Enhance prompt", false),
    ],
    media: [m.reference(16)],
    batch: { native: false, max: 4 },
    notes: "Campaign visuals from a prompt and product/model references. (Presets not exposed yet.)",
    price: perImage(0.0121),
    body: (i, st) => {
      const refs = urls(i, "reference");
      return { ...std(i, st), ...(refs.length ? { image_urls: refs } : {}) };
    },
  },
  {
    id: "recraft/v4.1/text-to-image",
    provider: P,
    name: "Recraft V4.1",
    kind: "image",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["1:1", "2:1", "1:2", "3:2", "2:3", "4:3", "3:4", "5:4", "4:5", "6:10", "14:10", "10:14", "16:9", "9:16"], "1:1"),
      s.enum("output_format", "Format", ["jpg", "png", "webp"], "jpg"),
    ],
    media: [],
    batch: { native: false, max: 4 },
    notes: "1K tier; see Recraft V4.1 Pro for 2K.",
    price: perImage(0.035),
    body: (i, st) => ({ ...std(i, st), resolution: "1k" }),
  },

  // ───────────────────────────── VIDEO ─────────────────────────────
  {
    id: "kling-video/v3.0/std/text-to-video",
    provider: P,
    name: "Kling 3.0 Standard",
    kind: "video",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["16:9", "9:16", "1:1"], "16:9"),
      s.number("duration", "Duration", 3, 15, 1, 5, "s"),
      s.bool("sound", "Sound", true),
      s.number("cfg_scale", "CFG", 0, 1, 0.05, 0.5),
    ],
    media: [],
    batch: { native: false, max: 2 },
    body: (i, st) => ({ ...std(i, st), duration: Number(st.duration), sound: st.sound ? "on" : "off" }),
  },
  {
    id: "kling-video/v3.0/std/image-to-video",
    provider: P,
    name: "Kling 3.0 Standard · Image to video",
    kind: "video",
    settings: [s.number("duration", "Duration", 3, 15, 1, 5, "s"), s.bool("sound", "Sound", true), s.number("cfg_scale", "CFG", 0, 1, 0.05, 0.5)],
    media: [m.start(), m.end()],
    batch: { native: false, max: 2 },
    body: (i, st) => {
      const end = firstUrl(i, "end");
      return {
        ...std(i, st),
        duration: Number(st.duration),
        sound: st.sound ? "on" : "off",
        image_url: firstUrl(i, "start"),
        ...(end ? { end_image_url: end } : {}),
      };
    },
  },
  {
    id: "kling-video/v3.0-turbo/text-to-video",
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
    body: (i, st) => ({ ...std(i, st), duration: Number(st.duration) }),
  },
  {
    id: "kling-video/v2.5-turbo/pro/text-to-video",
    provider: P,
    name: "Kling 2.5 Turbo Pro",
    kind: "video",
    settings: [s.enum("duration", "Duration", ["5", "10"], "5"), s.number("cfg_scale", "CFG", 0, 1, 0.1, 0.5)],
    media: [],
    batch: { native: false, max: 2 },
    advanced: { negativePrompt: true },
    body: (i, st) => withNeg(i, { ...std(i, st), duration: Number(st.duration) }),
  },
  {
    id: "kling-video/v2.5-turbo/pro/image-to-video",
    provider: P,
    name: "Kling 2.5 Turbo Pro · Image to video",
    kind: "video",
    settings: [s.enum("duration", "Duration", ["5", "10"], "5"), s.number("cfg_scale", "CFG", 0, 1, 0.1, 0.5)],
    media: [m.start()],
    batch: { native: false, max: 2 },
    advanced: { negativePrompt: true },
    body: (i, st) => withNeg(i, { ...std(i, st), duration: Number(st.duration), image_url: firstUrl(i, "start") }),
  },
  {
    id: "bytedance/seedance-2.5/text-to-video",
    provider: P,
    name: "Seedance 2.5",
    kind: "video",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"], "16:9"),
      s.enum("resolution", "Resolution", ["480p", "720p"], "720p"),
      s.number("duration", "Duration", 4, 30, 1, 5, "s"),
      s.enum("bitrate_mode", "Bitrate", ["high", "standard"], "high"),
      s.bool("generate_audio", "Audio", true),
    ],
    media: [],
    batch: { native: false, max: 2 },
    body: (i, st) => ({ ...std(i, st), duration: Number(st.duration), output_format: "mp4" }),
  },
  {
    id: "bytedance/seedance-2.5/image-to-video",
    provider: P,
    name: "Seedance 2.5 · Image to video",
    kind: "video",
    settings: [
      s.enum("resolution", "Resolution", ["480p", "720p"], "720p"),
      s.number("duration", "Duration", 4, 30, 1, 5, "s"),
      s.bool("generate_audio", "Audio", true),
    ],
    media: [m.start(), m.end()],
    batch: { native: false, max: 2 },
    body: (i, st) => {
      const end = firstUrl(i, "end");
      return {
        ...std(i, st),
        duration: Number(st.duration),
        output_format: "mp4",
        image_url: firstUrl(i, "start"),
        ...(end ? { end_image_url: end } : {}),
      };
    },
  },
  {
    id: "bytedance/seedance-2.0/text-to-video",
    provider: P,
    name: "Seedance 2.0",
    kind: "video",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"], "16:9"),
      s.enum("resolution", "Resolution", ["480p", "720p", "1080p", "4k"], "720p"),
      s.number("duration", "Duration", 4, 15, 1, 5, "s"),
      s.bool("generate_audio", "Audio", true),
    ],
    media: [],
    batch: { native: false, max: 2 },
    body: (i, st) => ({ ...std(i, st), duration: Number(st.duration) }),
  },
  {
    id: "minimax/hailuo-2.3/standard/text-to-video",
    provider: P,
    name: "Hailuo 2.3 Standard",
    kind: "video",
    settings: [s.enum("duration", "Duration", ["6", "10"], "6"), s.bool("prompt_optimizer", "Optimize prompt", true)],
    media: [],
    batch: { native: false, max: 2 },
    body: (i, st) => ({ ...std(i, st), duration: Number(st.duration) }),
  },
  {
    id: "minimax/hailuo-2.3/standard/image-to-video",
    provider: P,
    name: "Hailuo 2.3 Standard · Image to video",
    kind: "video",
    settings: [s.enum("duration", "Duration", ["6", "10"], "6"), s.bool("prompt_optimizer", "Optimize prompt", true)],
    media: [m.start()],
    batch: { native: false, max: 2 },
    body: (i, st) => ({ ...std(i, st), duration: Number(st.duration), image_url: firstUrl(i, "start") }),
  },
  {
    id: "alibaba/wan-3.0/text-to-video",
    provider: P,
    name: "Wan 3.0",
    kind: "video",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["16:9", "9:16", "1:1", "4:3", "3:4"], "16:9"),
      s.enum("resolution", "Resolution", ["480p", "720p", "1080p"], "1080p"),
      s.number("duration", "Duration", 2, 30, 1, 8, "s"),
      s.bool("generate_audio", "Audio", true),
    ],
    media: [],
    batch: { native: false, max: 2 },
    advanced: { seed: true },
    body: (i, st) => withSeed(i, { ...std(i, st), duration: Number(st.duration) }),
  },
  {
    id: "alibaba/wan-3.0/reference-to-video",
    provider: P,
    name: "Wan 3.0 · Reference to video",
    kind: "video",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["adaptive", "16:9", "9:16", "1:1", "4:3", "3:4"], "16:9"),
      s.enum("resolution", "Resolution", ["480p", "720p", "1080p"], "1080p"),
      s.number("duration", "Duration", 2, 30, 1, 8, "s"),
      s.bool("generate_audio", "Audio", true),
    ],
    media: [m.reference(10, 1)],
    batch: { native: false, max: 2 },
    promptRefs: "Image N",
    notes: "Mention references as @image1, @image2…",
    body: (i, st) => ({ ...std(i, st), duration: Number(st.duration), image_urls: urls(i, "reference") }),
  },
  {
    id: "alibaba/wan-3.0/image-to-video",
    provider: P,
    name: "Wan 3.0 · Image to video",
    kind: "video",
    settings: [
      s.enum("resolution", "Resolution", ["480p", "720p", "1080p"], "1080p"),
      s.number("duration", "Duration", 2, 30, 1, 8, "s"),
      s.bool("generate_audio", "Audio", true),
    ],
    media: [m.start(), m.end()],
    batch: { native: false, max: 2 },
    advanced: { seed: true },
    body: (i, st) => {
      const end = firstUrl(i, "end");
      return withSeed(i, {
        ...std(i, st),
        duration: Number(st.duration),
        aspect_ratio: "adaptive",
        image_url: firstUrl(i, "start"),
        ...(end ? { end_image_url: end } : {}),
      });
    },
  },
  // ───────────────────────── MORE VIDEO (explore catalog, 2026-09) ─────────────────────────
  {
    id: "minimax/h3/text-to-video",
    provider: P,
    name: "MiniMax H3",
    kind: "video",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["auto", "16:9", "9:16", "1:1", "4:3", "3:4", "21:9"], "16:9"),
      s.number("duration", "Duration", 5, 15, 1, 5, "s"),
    ],
    media: [],
    batch: { native: false, max: 2 },
    notes: "2K output.",
    price: sec(0.0715, 5),
    body: (i, st) => ({ ...std(i, st), duration: Number(st.duration), resolution: "2K" }),
  },
  ...(["fast", "pro"] as const).map((tier): HiggsfieldEntry => ({
    id: `lightricks/ltx-2.5/text-to-video/${tier}`,
    provider: P,
    name: tier === "fast" ? "LTX 2.5 Fast" : "LTX 2.5 Pro",
    kind: "video",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["16:9", "9:16"], "16:9"),
      s.enum("resolution", "Resolution", tier === "fast" ? ["720p", "1080p", "2k", "4k"] : ["720p", "1080p"], "720p"),
      s.enum("duration", "Duration", ["6", "8", "10"], "6"),
      s.enum("fps", "FPS", tier === "fast" ? ["24", "25", "48", "50"] : ["24", "25", "50"], "25"),
      s.enum("camera_movement", "Camera", ["none", "static", "dolly_in", "dolly_out", "dolly_left", "dolly_right", "jib_up", "jib_down", "focus_shift"], "none"),
      s.bool("generate_audio", "Audio", true),
    ],
    media: [],
    batch: { native: false, max: 2 },
    price: sec(tier === "fast" ? 0.09 : 0.12, 6),
    body: (i, st) => {
      const { camera_movement, ...rest } = st;
      return { ...std(i, rest), duration: Number(st.duration), fps: Number(st.fps), ...(camera_movement !== "none" ? { camera_movement } : {}) };
    },
  })),
  {
    id: "xai/grok-imagine-video/v1.5/reference-to-video",
    provider: P,
    name: "Grok Imagine Video 1.5",
    kind: "video",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["auto", "16:9", "9:16", "1:1", "4:3", "3:4", "3:2", "2:3"], "16:9"),
      s.enum("resolution", "Resolution", ["480p", "720p", "1080p"], "720p"),
      s.number("duration", "Duration", 1, 15, 1, 5, "s"),
    ],
    media: [m.start(false), m.reference(7)],
    batch: { native: false, max: 2 },
    promptRefs: "at-image",
    price: sec(0.08, 5),
    body: (i, st) => {
      const start = firstUrl(i, "start");
      const refs = urls(i, "reference");
      return { ...std(i, st), duration: Number(st.duration), ...(start ? { image_url: start } : {}), ...(refs.length ? { image_urls: refs } : {}) };
    },
  },
  {
    id: "wan/v2.7/text-to-video",
    provider: P,
    name: "Wan 2.7",
    kind: "video",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["16:9", "9:16", "1:1", "4:3", "3:4"], "16:9"),
      s.enum("resolution", "Resolution", ["720p", "1080p"], "720p"),
      s.number("duration", "Duration", 2, 15, 1, 5, "s"),
      s.bool("prompt_extend", "Rewrite prompt", false),
    ],
    media: [],
    batch: { native: false, max: 2 },
    advanced: { negativePrompt: true, seed: true },
    price: sec(0.1, 5),
    body: (i, st) => withSeed(i, withNeg(i, { ...std(i, st), duration: Number(st.duration) })),
  },
  {
    id: "wan/v2.6/text-to-video",
    provider: P,
    name: "Wan 2.6",
    kind: "video",
    settings: [
      s.enum("resolution", "Resolution", ["720p", "1080p"], "720p"),
      s.enum("duration", "Duration", ["5", "10", "15"], "5"),
      s.bool("prompt_extend", "Rewrite prompt", false),
    ],
    media: [],
    batch: { native: false, max: 2 },
    advanced: { seed: true },
    price: sec(0.1, 5),
    body: (i, st) => withSeed(i, { ...std(i, st), duration: Number(st.duration), multi_shots: false }),
  },
  ...([
    ["alibaba/happy-horse/v1.1/text-to-video", "Happy Horse 1.1", "1080p"],
    ["alibaba/happy-horse/text-to-video", "Happy Horse 1.0", "720p"],
  ] as const).map(([id, name, res]): HiggsfieldEntry => ({
    id,
    provider: P,
    name,
    kind: "video",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["16:9", "9:16", "1:1", "4:3", "3:4"], "16:9"),
      s.enum("resolution", "Resolution", ["720p", "1080p"], res),
      s.number("duration", "Duration", 3, 15, 1, 5, "s"),
    ],
    media: [],
    batch: { native: false, max: 2 },
    advanced: { seed: true },
    price: sec(0.077, 5),
    body: (i, st) => withSeed(i, { ...std(i, st), duration: Number(st.duration) }),
  })),
  {
    id: "pixverse/v6/text-to-video",
    provider: P,
    name: "PixVerse 6",
    kind: "video",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["16:9", "9:16", "1:1", "4:3", "3:4"], "16:9"),
      s.enum("resolution", "Resolution", ["360p", "540p", "720p", "1080p"], "720p"),
      s.number("duration", "Duration", 1, 15, 1, 5, "s"),
      s.bool("generate_audio", "Audio", true),
    ],
    media: [],
    batch: { native: false, max: 2 },
    advanced: { negativePrompt: true, seed: true },
    price: sec(0.0978, 5),
    body: (i, st) => withSeed(i, withNeg(i, { ...std(i, st), duration: Number(st.duration) })),
  },
  {
    id: "kling-video/o3/first-last-frame",
    provider: P,
    name: "Kling O3",
    kind: "video",
    settings: [
      s.enum("mode", "Mode", ["std", "pro", "4k"], "pro"),
      s.enum("aspect_ratio", "Aspect", ["16:9", "9:16", "1:1"], "16:9"),
      s.number("duration", "Duration", 3, 15, 1, 5, "s"),
      s.bool("sound", "Sound", false),
    ],
    media: [m.start(false), m.end()],
    batch: { native: false, max: 2 },
    notes: "Text, first frame, or first + last frame.",
    price: sec(0.042, 5),
    body: (i, st) => {
      const first = firstUrl(i, "start");
      const last = firstUrl(i, "end");
      return {
        ...std(i, st),
        duration: Number(st.duration),
        sound: st.sound ? "on" : "off",
        multi_shots: false,
        ...(first ? { first_frame_url: first } : {}),
        ...(last ? { last_frame_url: last } : {}),
      };
    },
  },
  {
    id: "kling-video/omni/first-last-frame",
    provider: P,
    name: "Kling O1 (Omni) · Image to video",
    kind: "video",
    settings: [s.enum("mode", "Mode", ["std", "pro"], "pro"), s.enum("aspect_ratio", "Aspect", ["16:9", "9:16", "1:1"], "16:9"), s.enum("duration", "Duration", ["5", "10"], "5")],
    media: [m.start(), m.end()],
    batch: { native: false, max: 2 },
    price: sec(0.042, 5),
    body: (i, st) => {
      const last = firstUrl(i, "end");
      return { ...std(i, st), duration: Number(st.duration), first_frame_url: firstUrl(i, "start"), ...(last ? { last_frame_url: last } : {}) };
    },
  },
  {
    id: "kling-video/v2.6/pro/text-to-video",
    provider: P,
    name: "Kling 2.6 Pro",
    kind: "video",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["16:9", "9:16", "1:1"], "16:9"),
      s.enum("duration", "Duration", ["5", "10"], "5"),
      s.bool("sound", "Sound", true),
      s.number("cfg_scale", "CFG", 0, 1, 0.1, 0.5),
    ],
    media: [],
    batch: { native: false, max: 2 },
    price: sec(0.035, 5),
    body: (i, st) => ({ ...std(i, st), duration: Number(st.duration), sound: st.sound ? "on" : "off" }),
  },
  {
    id: "kling-video/v2.5-turbo/standard/image-to-video",
    provider: P,
    name: "Kling 2.5 Turbo Standard · Image to video",
    kind: "video",
    settings: [s.enum("duration", "Duration", ["5", "10"], "5"), s.number("cfg_scale", "CFG", 0, 1, 0.1, 0.5)],
    media: [m.start()],
    batch: { native: false, max: 2 },
    advanced: { negativePrompt: true },
    price: sec(0.021, 5),
    body: (i, st) => withNeg(i, { ...std(i, st), duration: Number(st.duration), image_url: firstUrl(i, "start") }),
  },
  {
    id: "higgsfield/cinema-studio/4.0",
    provider: P,
    name: "Cinema Studio 4.0",
    kind: "video",
    settings: [
      s.enum("aspect_ratio", "Aspect", ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"], "16:9"),
      s.enum("resolution", "Resolution", ["480p", "720p"], "720p"),
      s.number("duration", "Duration", 4, 30, 1, 5, "s"),
      s.bool("generate_audio", "Audio", true),
      s.enum("genre", "Genre", ["auto", "epic", "drama", "noir", "comedy", "horror", "action"], "auto"),
      s.enum("era", "Era", ["auto", "1960s", "1980s", "1990s", "2000s", "2020s"], "auto"),
      s.enum("pacing", "Pacing", ["auto", "chaotic", "dynamic", "calm", "single-shot"], "auto"),
      s.enum("light", "Light", ["auto", "silhouette", "practicals", "window", "overhead-fall", "contre-jour", "soft-cross"], "auto"),
      s.enum("camera_model", "Camera", ["auto", "modern", "35mm-film", "8mm-film", "dv-camcorder"], "auto"),
      s.enum("camera_lens", "Lens", ["auto", "clean-sharp", "anamorphic", "vintage-anamorphic", "warm-vintage", "halation-vintage"], "auto"),
      s.enum("camera_aperture", "Aperture", ["auto", "f14-wide-open", "f4-moderate", "f11-deep-focus"], "auto"),
      s.enum(
        "camera_movement",
        "Movement",
        ["auto", "static", "handheld", "tracking", "side-tracking", "pov", "pan-left", "pan-right", "tilt-up", "tilt-down", "crane-up", "crane-down", "pedestal-up", "pedestal-down", "rack-focus", "drone-orbit", "robot-arm", "snorricam"],
        "auto",
      ),
    ],
    media: [m.reference(30)],
    batch: { native: false, max: 2 },
    notes: "Higgsfield's directed-cinema model. 'auto' leaves a choice to the model.",
    price: sec(0.2057, 5),
    body: (i, st) => {
      const body: Record<string, unknown> = { prompt: i.prompt, duration: Number(st.duration), aspect_ratio: st.aspect_ratio, resolution: st.resolution, generate_audio: st.generate_audio };
      for (const k of ["genre", "era", "pacing", "light", "camera_model", "camera_lens", "camera_aperture", "camera_movement"]) if (st[k] !== "auto") body[k] = st[k];
      const refs = urls(i, "reference");
      if (refs.length) body.image_urls = refs;
      return body;
    },
  },
  {
    id: "higgsfiled/genjutsu/motion-transfer/v1.0",
    provider: P,
    name: "Genjutsu Motion Transfer",
    kind: "video",
    settings: [s.enum("resolution", "Resolution", ["720p", "480p"], "720p")],
    media: [m.video(), m.reference(8, 1)],
    batch: { native: false, max: 2 },
    notes: "Re-imagines a driving video with your reference images. Endpoint id is spelled 'higgsfiled' upstream.",
    price: sec(0.159, 5),
    body: (i, st) => ({ ...std(i, st), video_url: firstUrl(i, "video"), image_urls: urls(i, "reference") }),
  },
];
