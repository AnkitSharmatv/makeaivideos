import { describe, expect, it } from "vitest";
import { KIE_CATALOG, KIE_CREDIT_USD } from "../kie/catalog";
import { FAL_CATALOG } from "../fal/catalog";
import { resolveSettings } from "../catalog-utils";

const kie = (id: string) => KIE_CATALOG.find((m) => m.id === id)!;
const fal = (id: string) => FAL_CATALOG.find((m) => m.id === id)!;

describe("KIE published rates (1 credit = $0.005)", () => {
  it("Nano Banana is 4 credits", () => {
    const m = kie("google/nano-banana");
    expect(m.price!(resolveSettings(m, {}), 1)).toEqual({ credits: 4, usd: 4 * KIE_CREDIT_USD, approx: true });
  });
  it("Nano Banana Pro is 8 credits at 1K/2K and 14 at 4K", () => {
    const m = kie("nano-banana-pro");
    expect(m.price!(resolveSettings(m, { resolution: "2K" }), 1)?.credits).toBe(8);
    expect(m.price!(resolveSettings(m, { resolution: "4K" }), 1)?.credits).toBe(14);
  });
  it("Kling 2.6 doubles with sound and with 10s", () => {
    const m = kie("kling-2.6/text-to-video");
    expect(m.price!(resolveSettings(m, { sound: false, duration: "5" }), 1)?.credits).toBe(55);
    expect(m.price!(resolveSettings(m, { sound: true, duration: "10" }), 1)?.credits).toBe(220);
  });
  it("Veo 3.1 scales with resolution", () => {
    const m = kie("veo-3-1");
    expect(m.price!(resolveSettings(m, { resolution: "4k" }), 1)?.credits).toBe(370);
  });
  it("every KIE model has a price", () => {
    for (const m of KIE_CATALOG) expect(m.price?.(resolveSettings(m, {}), 1), m.id).toBeTruthy();
  });
});

describe("FAL published rates", () => {
  it("multiplies per-image models by the native batch", () => {
    const m = fal("fal-ai/nano-banana");
    expect(m.price!(resolveSettings(m, {}), 3)?.usd).toBeCloseTo(0.117);
  });
  it("Veo 3.1 bills per second with audio", () => {
    const m = fal("fal-ai/veo3.1");
    expect(m.price!(resolveSettings(m, { duration: "8s", generate_audio: true }), 1)?.usd).toBeCloseTo(3.2);
    expect(m.price!(resolveSettings(m, { duration: "4s", generate_audio: false }), 1)?.usd).toBeCloseTo(0.8);
  });
  it("Kling 2.5 Turbo Pro adds $0.07 per extra second", () => {
    const m = fal("fal-ai/kling-video/v2.5-turbo/pro/text-to-video");
    expect(m.price!(resolveSettings(m, { duration: "10" }), 1)?.usd).toBeCloseTo(0.7);
  });
  it("every FAL model has a price", () => {
    for (const m of FAL_CATALOG) expect(m.price?.(resolveSettings(m, {}), 1), m.id).toBeTruthy();
  });
});
