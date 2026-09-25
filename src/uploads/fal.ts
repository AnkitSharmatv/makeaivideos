import { ProviderError } from "@/providers/types";
import { errorDetail, requestJson } from "@/providers/http";
import type { UploadBackend } from "./types";

/**
 * fal storage, as used by @fal-ai/client: initiate → { upload_url, file_url }, then PUT the bytes.
 * Not verified against a live key in this project; see fal/README.md.
 */
const FAL_REST = "https://rest.alpha.fal.ai";
const FAL_UPLOAD_TTL = 7 * 24 * 60 * 60 * 1000;

export const uploadToFal: UploadBackend = async (file, name, contentType, key) => {
  const init = await requestJson<{ upload_url?: string; file_url?: string }>(`${FAL_REST}/storage/upload/initiate?storage_type=fal-cdn-v3`, {
    method: "POST",
    headers: { Authorization: `Key ${key}` },
    body: { content_type: contentType, file_name: name },
  });
  if (!init.ok || !init.data?.upload_url || !init.data.file_url) {
    throw new ProviderError(`FAL upload URL failed (${init.status}). ${errorDetail(init.data, init.text)}`, init.status === 401 ? "auth" : "unknown", init.status);
  }
  const put = await fetch(init.data.upload_url, { method: "PUT", headers: { "Content-Type": contentType }, body: file });
  if (!put.ok) throw new ProviderError(`FAL upload failed (${put.status}).`, "unknown", put.status);
  return { url: init.data.file_url, expiresAt: Date.now() + FAL_UPLOAD_TTL };
};
