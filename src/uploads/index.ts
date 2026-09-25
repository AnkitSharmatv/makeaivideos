import type { ProviderId } from "@/providers/types";
import type { UploadBackend } from "./types";
import { uploadToKie } from "./kie";
import { uploadToFal } from "./fal";
import { uploadToHiggsfield } from "./higgsfield";

/** Each provider hosts its own inputs; no third-party bucket is needed. */
const BACKENDS: Record<ProviderId, UploadBackend> = {
  kie: uploadToKie,
  fal: uploadToFal,
  higgsfield: uploadToHiggsfield,
};

export function uploadBackend(provider: ProviderId): UploadBackend {
  return BACKENDS[provider];
}

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
