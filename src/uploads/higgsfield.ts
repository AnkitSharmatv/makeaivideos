import { ProviderError } from "@/providers/types";
import { errorDetail, requestJson } from "@/providers/http";
import { HF_BASE } from "@/providers/higgsfield";
import type { UploadBackend } from "./types";

/** docs.higgsfield.ai/docs/concepts/file-uploads — presigned PUT, tagged retention=temporary. */
const HF_UPLOAD_TTL = 24 * 60 * 60 * 1000;

export const uploadToHiggsfield: UploadBackend = async (file, _name, contentType, key) => {
  const init = await requestJson<{ public_url?: string; upload_url?: string; upload_headers?: Record<string, string> }>(
    `${HF_BASE}/files/generate-upload-url`,
    { method: "POST", headers: { Authorization: `Key ${key}` }, body: { content_type: contentType } },
  );
  if (!init.ok || !init.data?.upload_url || !init.data.public_url) {
    throw new ProviderError(`Higgsfield upload URL failed (${init.status}). ${errorDetail(init.data, init.text)}`, init.status === 401 ? "auth" : "unknown", init.status);
  }
  const put = await fetch(init.data.upload_url, {
    method: "PUT",
    headers: { "Content-Type": contentType, ...(init.data.upload_headers ?? {}) },
    body: file,
  });
  if (!put.ok) throw new ProviderError(`Higgsfield upload failed (${put.status}).`, "unknown", put.status);
  return { url: init.data.public_url, expiresAt: Date.now() + HF_UPLOAD_TTL };
};
