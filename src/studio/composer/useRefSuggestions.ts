"use client";

import { useMemo } from "react";
import type { ModelSpec } from "@/providers/types";
import { usePromptStore } from "@/stores/prompt";
import { useUploadsStore, uploadPreview } from "@/stores/uploads";
import { useLibraryStore, assetThumb } from "@/stores/library";
import type { TagSuggestion } from "./PromptInput";

const EMPTY: never[] = [];

/** `@image1`, `@image2`… for whatever is in the Reference slot, with thumbnails. */
export function useRefSuggestions(model: ModelSpec | null): TagSuggestion[] {
  const refs = usePromptStore((s) => s.media.reference ?? EMPTY);
  const uploads = useUploadsStore((s) => s.uploads);
  const assets = useLibraryStore((s) => s.assets);
  const takesRefs = !!model?.media.some((r) => r.role === "reference");
  return useMemo(() => {
    if (!takesRefs) return [];
    return refs.map((r, i) => {
      let thumb: string | undefined;
      let label = "reference";
      let video = false;
      if (r.type === "upload") {
        const u = uploads.find((x) => x.id === r.id);
        if (u) {
          thumb = uploadPreview(u);
          label = u.name;
          video = u.kind === "video";
        }
      } else if (r.type === "asset") {
        const a = assets.find((x) => x.id === r.id);
        if (a) {
          thumb = assetThumb(a);
          label = a.prompt.slice(0, 40);
          video = a.kind === "video";
        }
      } else {
        thumb = r.url;
        label = r.url;
      }
      return { tag: `@image${i + 1}`, label, thumb, video };
    });
  }, [refs, uploads, assets, takesRefs]);
}

/** One-line explanation of how the tags reach the model. */
export function refHint(model: ModelSpec | null, count: number): string | null {
  if (!model || count === 0) return null;
  switch (model.promptRefs) {
    case "at-image":
      return `Mention references as @image1…@image${count}; ${model.name} reads them as-is.`;
    case "ImageN":
      return `Mention references as @image1…@image${count}; sent to ${model.name} as Image1…Image${count}.`;
    case "Image N":
      return `Mention references as @image1…@image${count}; sent to ${model.name} as "Image 1"…"Image ${count}".`;
    case "elements":
      return `Each reference becomes a named subject; @image1…@image${count} in the prompt keeps it consistent across the clip.`;
    default:
      return `${model.name} has no tag syntax — @image1…@image${count} are sent as plain "image 1", so also describe what you mean.`;
  }
}
