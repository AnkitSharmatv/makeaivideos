import { describe, expect, it } from "vitest";
import { buildHiggsfieldRequest, normalizeHiggsfieldStatus } from "../higgsfield";
import { input, HF_STATUS_COMPLETED_IMAGE, HF_STATUS_COMPLETED_VIDEO } from "./fixtures";

describe("Higgsfield request mapping", () => {
  it("uses batch_size 1|4 for SOUL", () => {
    expect(buildHiggsfieldRequest(input("higgsfield-ai/soul/v2/standard", { count: 2 })).body.batch_size).toBe(1);
    expect(buildHiggsfieldRequest(input("higgsfield-ai/soul/v2/standard", { count: 4 })).body.batch_size).toBe(4);
  });

  it("maps Kling 3.0 sound to on/off strings and duration to a number", () => {
    const r = buildHiggsfieldRequest(input("kling-video/v3.0/std/text-to-video", { settings: { sound: false, duration: 7 } }));
    expect(r.path).toBe("/kling-video/v3.0/std/text-to-video");
    expect(r.body).toMatchObject({ sound: "off", duration: 7, aspect_ratio: "16:9", cfg_scale: 0.5 });
  });

  it("maps Seedance 2.5 image-to-video frames and forces mp4", () => {
    const r = buildHiggsfieldRequest(input("bytedance/seedance-2.5/image-to-video", { media: { start: ["https://x/a.jpg"] } }));
    expect(r.body).toMatchObject({ image_url: "https://x/a.jpg", output_format: "mp4", resolution: "720p" });
    expect(r.body).not.toHaveProperty("end_image_url");
  });
});

describe("Higgsfield status normalization", () => {
  it("maps queued/in_progress", () => {
    expect(normalizeHiggsfieldStatus({ status: "queued" }, input("higgsfield-ai/soul/standard"))).toEqual({ state: "queued" });
    expect(normalizeHiggsfieldStatus({ status: "in_progress" }, input("higgsfield-ai/soul/standard"))).toEqual({ state: "running" });
  });
  it("maps completed images", () => {
    const s = normalizeHiggsfieldStatus(HF_STATUS_COMPLETED_IMAGE, input("higgsfield-ai/soul/standard", { settings: { aspect_ratio: "3:4" } }));
    expect(s.state).toBe("done");
    if (s.state !== "done") return;
    expect(s.outputs).toHaveLength(2);
    expect(s.outputs[0]).toMatchObject({ kind: "image", width: 768, height: 1024 });
  });
  it("maps completed video with duration from settings", () => {
    const s = normalizeHiggsfieldStatus(HF_STATUS_COMPLETED_VIDEO, input("bytedance/seedance-2.5/text-to-video", { settings: { duration: 6 } }));
    expect(s).toEqual({ state: "done", outputs: [{ url: "https://cdn.higgsfield.ai/v.mp4", kind: "video", width: 1024, height: 576, duration: 6 }] });
  });
  it("maps nsfw / failed / canceled", () => {
    expect(normalizeHiggsfieldStatus({ status: "nsfw" }, input("higgsfield-ai/soul/standard"))).toMatchObject({ state: "failed", code: "nsfw" });
    expect(normalizeHiggsfieldStatus({ status: "failed", error: "boom" }, input("higgsfield-ai/soul/standard"))).toEqual({ state: "failed", reason: "boom", code: "unknown" });
    expect(normalizeHiggsfieldStatus({ status: "canceled" }, input("higgsfield-ai/soul/standard"))).toMatchObject({ code: "canceled" });
  });
});

describe("prompt reference tags", () => {
  it("rewrites @imageN to 'Image N' for Wan 3.0 reference-to-video", () => {
    const r = buildHiggsfieldRequest(input("alibaba/wan-3.0/reference-to-video", { prompt: "@image1 in the style of @image2", media: { reference: ["https://x/a.jpg", "https://x/b.jpg"] } }));
    expect(r.body.prompt).toBe("Image 1 in the style of Image 2");
    expect(r.body.image_urls).toEqual(["https://x/a.jpg", "https://x/b.jpg"]);
  });
});
