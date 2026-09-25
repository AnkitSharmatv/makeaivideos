import { describe, expect, it } from "vitest";
import { allProviders } from "..";
import { KIE_CATALOG } from "../kie/catalog";
import { FAL_CATALOG } from "../fal/catalog";
import { HIGGSFIELD_CATALOG } from "../higgsfield/catalog";
import { resolveSettings } from "../catalog-utils";
import { input } from "./fixtures";

const ALL = [...KIE_CATALOG, ...FAL_CATALOG, ...HIGGSFIELD_CATALOG];

describe("catalog integrity", () => {
  it("has unique ids per provider", () => {
    for (const p of allProviders()) {
      const ids = p.catalog.map((m) => m.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("declares every enum default inside its values and every number default in range", () => {
    for (const m of ALL) {
      for (const s of m.settings) {
        if (s.type === "enum") expect(s.values, `${m.id}.${s.key}`).toContain(s.default);
        if (s.type === "number") {
          expect(s.default, `${m.id}.${s.key}`).toBeGreaterThanOrEqual(s.min);
          expect(s.default, `${m.id}.${s.key}`).toBeLessThanOrEqual(s.max);
        }
      }
    }
  });

  it("builds a body with a prompt for every model when required media is supplied", () => {
    for (const m of ALL) {
      const media: Record<string, string[]> = {};
      for (const r of m.media) if (r.min > 0) media[r.role] = Array.from({ length: r.min }, (_, i) => `https://x/${r.role}${i}.jpg`);
      const body = m.body(input(m.id, { media }), resolveSettings(m, {}), 1);
      expect(typeof body.prompt, m.id).toBe("string");
      expect(JSON.stringify(body)).not.toContain("undefined");
    }
  });

  it("has at least 3 image and 3 video models per provider", () => {
    for (const p of allProviders()) {
      expect(p.catalog.filter((m) => m.kind === "image").length, p.id).toBeGreaterThanOrEqual(3);
      expect(p.catalog.filter((m) => m.kind === "video").length, p.id).toBeGreaterThanOrEqual(3);
    }
  });
});
