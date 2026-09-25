/**
 * Turns composer media refs into public URLs the target provider can fetch.
 * Uploads are (re)sent to that provider when they have no live URL there.
 */
import type { MediaRefs } from "@/db/types";
import type { GenerateInput, MediaRole, ProviderId } from "@/providers/types";
import { useUploadsStore } from "@/stores/uploads";
import { useLibraryStore } from "@/stores/library";

export async function resolveMedia(refs: MediaRefs, provider: ProviderId): Promise<GenerateInput["media"]> {
  const out: GenerateInput["media"] = {};
  for (const [role, list] of Object.entries(refs) as [MediaRole, MediaRefs[MediaRole]][]) {
    if (!list || list.length === 0) continue;
    const urls: string[] = [];
    for (const ref of list) {
      if (ref.type === "url") urls.push(ref.url);
      else if (ref.type === "asset") {
        const a = useLibraryStore.getState().assets.find((x) => x.id === ref.id);
        if (!a) throw new Error("An attached result was deleted from the library.");
        urls.push(a.url);
      } else {
        urls.push(await useUploadsStore.getState().ensureRemote(ref.id, provider));
      }
    }
    out[role] = urls;
  }
  return out;
}

/** Roles whose minimum isn't met by the current refs. */
export function countRefs(refs: MediaRefs, role: MediaRole): number {
  return refs[role]?.length ?? 0;
}
