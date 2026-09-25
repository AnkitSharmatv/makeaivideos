import { describe, expect, it } from "vitest";
import { buildKieRequest, normalizeKieStatus } from "../kie";
import { input, KIE_RECORD_SUCCESS } from "./fixtures";

describe("KIE request mapping", () => {
  it("fills defaults for nano-banana", () => {
    const r = buildKieRequest(input("google/nano-banana"));
    expect(r).toEqual({ model: "google/nano-banana", input: { prompt: "a red kite over a grey beach", aspect_ratio: "1:1", output_format: "png" } });
  });

  it("rejects out-of-range enum values back to defaults", () => {
    const r = buildKieRequest(input("google/nano-banana", { settings: { aspect_ratio: "7:3" } }));
    expect(r.input.aspect_ratio).toBe("1:1");
  });

  it("maps Veo 3.1 frames into image_urls + generation_type", () => {
    const r = buildKieRequest(input("veo-3-1", { media: { start: ["https://x/a.jpg"], end: ["https://x/b.jpg"] }, settings: { duration: "6" } }));
    expect(r.model).toBe("veo-3-1");
    expect(r.input).toMatchObject({
      image_urls: ["https://x/a.jpg", "https://x/b.jpg"],
      generation_type: "FIRST_AND_LAST_FRAMES_2_VIDEO",
      duration: 6,
      aspect_ratio: "16:9",
    });
  });

  it("uses TEXT_2_VIDEO for Veo without frames", () => {
    const r = buildKieRequest(input("veo-3-1"));
    expect(r.input.generation_type).toBe("TEXT_2_VIDEO");
    expect(r.input).not.toHaveProperty("image_urls");
  });

  it("disables multi-shot for Kling 3.0 Omni and sends a numeric duration", () => {
    const r = buildKieRequest(input("kling-3.0-omni/text-to-video", { settings: { duration: 8 } }));
    expect(r.input).toMatchObject({ customize_multi_shots: false, duration: 8, elements: [] });
  });

  it("adds negative prompt and seed only when the model declares them", () => {
    const withNeg = buildKieRequest(input("qwen/text-to-image", { negativePrompt: "blurry", seed: 7 }));
    expect(withNeg.input).toMatchObject({ negative_prompt: "blurry", seed: 7 });
    const without = buildKieRequest(input("google/nano-banana", { negativePrompt: "blurry", seed: 7 }));
    expect(without.input).not.toHaveProperty("negative_prompt");
    expect(without.input).not.toHaveProperty("seed");
  });
});

describe("KIE status normalization", () => {
  it("maps waiting/queuing → queued and generating → running with progress", () => {
    expect(normalizeKieStatus({ state: "waiting" }, input("google/nano-banana"))).toEqual({ state: "queued" });
    expect(normalizeKieStatus({ state: "queuing" }, input("google/nano-banana"))).toEqual({ state: "queued" });
    expect(normalizeKieStatus({ state: "generating", progress: 45 }, input("google/nano-banana"))).toEqual({ state: "running", progress: 0.45 });
  });

  it("parses resultJson on success and infers dimensions from aspect ratio", () => {
    const s = normalizeKieStatus(KIE_RECORD_SUCCESS, input("google/nano-banana", { settings: { aspect_ratio: "16:9" } }));
    expect(s.state).toBe("done");
    if (s.state !== "done") return;
    expect(s.outputs).toHaveLength(2);
    expect(s.outputs[0]).toMatchObject({ url: "https://cdn.kie.ai/a.png", kind: "image", width: 1024, height: 576 });
  });

  it("maps fail with a moderation message to nsfw", () => {
    const s = normalizeKieStatus({ state: "fail", failCode: "422", failMsg: "Content flagged as sensitive" }, input("google/nano-banana"));
    expect(s).toEqual({ state: "failed", reason: "Content flagged as sensitive", code: "nsfw" });
  });

  it("treats success with no urls as a failure", () => {
    const s = normalizeKieStatus({ state: "success", resultJson: "{}" }, input("google/nano-banana"));
    expect(s.state).toBe("failed");
  });
});

describe("prompt reference tags", () => {
  it("keeps @imageN for Grok and turns references into named elements for Kling 3.0", () => {
    const grok = buildKieRequest(input("grok-imagine/image-to-video", { prompt: "@image1 walks past @image2", media: { reference: ["https://x/a.jpg", "https://x/b.jpg"] } }));
    expect(grok.input.prompt).toBe("@image1 walks past @image2");
    const kling = buildKieRequest(input("kling-3.0/video", { prompt: "@image1 runs on the beach", media: { reference: ["https://x/a.jpg"] } }));
    expect(kling.input.prompt).toBe("@image1 runs on the beach");
    expect(kling.input.kling_elements).toEqual([{ name: "image1", description: "reference image 1", element_input_urls: ["https://x/a.jpg"] }]);
  });
  it("rewrites tags to Image1 for Wan 3.0 and to plain text for models without syntax", () => {
    const wan = buildKieRequest(input("wan/3-0-video", { prompt: "Use @image1 as the hero, @image2 for lighting", media: { reference: ["https://x/a.jpg", "https://x/b.jpg"] } }));
    expect(wan.input.prompt).toBe("Use Image1 as the hero, Image2 for lighting");
    const seedance = buildKieRequest(input("bytedance/seedance-2-5", { prompt: "the apple from @image1", media: { reference: ["https://x/a.jpg"] } }));
    expect(seedance.input.prompt).toBe("the apple from image 1");
  });
});

describe("single-image models never receive a second frame", () => {
  it("Kling 3.0 Turbo and Kling 2.6 image-to-video send only the start frame", () => {
    for (const id of ["kling/v3-turbo-image-to-video", "kling-2.6/image-to-video"]) {
      const r = buildKieRequest(input(id, { media: { start: ["https://x/a.jpg"], end: ["https://x/b.jpg"] } }));
      expect(r.input.image_urls, id).toEqual(["https://x/a.jpg"]);
    }
  });
});
