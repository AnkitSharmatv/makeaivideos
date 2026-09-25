import { describe, expect, it } from "vitest";
import { buildFalRequest, decodeFalJobId, encodeFalJobId, normalizeFalResult } from "../fal";
import { input, FAL_IMAGE_RESULT, FAL_VIDEO_RESULT } from "./fixtures";

describe("FAL request mapping", () => {
  it("sends num_images for native-batch models", () => {
    const r = buildFalRequest(input("fal-ai/flux/dev", { count: 3, seed: 5 }));
    expect(r.path).toBe("/fal-ai/flux/dev");
    expect(r.body).toMatchObject({ prompt: "a red kite over a grey beach", num_images: 3, seed: 5, image_size: "landscape_4_3", guidance_scale: 3.5, num_inference_steps: 28 });
  });

  it("clamps the batch to the model max", () => {
    const r = buildFalRequest(input("fal-ai/nano-banana", { count: 9 }));
    expect(r.body.num_images).toBe(4);
  });

  it("maps Kling image-to-video frames", () => {
    const r = buildFalRequest(input("fal-ai/kling-video/v2.5-turbo/pro/image-to-video", { media: { start: ["https://x/a.jpg"], end: ["https://x/b.jpg"] }, negativePrompt: "blur" }));
    expect(r.body).toMatchObject({ image_url: "https://x/a.jpg", tail_image_url: "https://x/b.jpg", negative_prompt: "blur", duration: "5" });
  });

  it("snaps Sora duration to an allowed value", () => {
    const r = buildFalRequest(input("fal-ai/sora-2/text-to-video", { settings: { duration: 10 } }));
    expect(r.body.duration).toBe(8);
  });
});

describe("FAL job ids", () => {
  it("round-trips the requests base path from status_url", () => {
    const id = encodeFalJobId("https://queue.fal.run/fal-ai/flux/requests/764cabcf/status", "764cabcf");
    expect(id).toBe("/fal-ai/flux|764cabcf");
    expect(decodeFalJobId(id)).toEqual({ base: "/fal-ai/flux", requestId: "764cabcf" });
  });
});

describe("FAL result normalization", () => {
  it("maps images[] with dimensions", () => {
    const s = normalizeFalResult(FAL_IMAGE_RESULT, "image");
    expect(s).toEqual({ state: "done", outputs: [{ url: "https://fal.media/x.jpeg", kind: "image", width: 1024, height: 768 }] });
  });
  it("maps video.url", () => {
    expect(normalizeFalResult(FAL_VIDEO_RESULT, "video")).toEqual({ state: "done", outputs: [{ url: "https://fal.media/v.mp4", kind: "video" }] });
  });
  it("flags all-nsfw batches", () => {
    const s = normalizeFalResult({ ...FAL_IMAGE_RESULT, has_nsfw_concepts: [true] }, "image");
    expect(s).toMatchObject({ state: "failed", code: "nsfw" });
  });
  it("fails on empty output", () => {
    expect(normalizeFalResult({ images: [] }, "image").state).toBe("failed");
  });
});
