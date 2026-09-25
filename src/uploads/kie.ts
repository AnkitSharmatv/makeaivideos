import { ProviderError } from "@/providers/types";
import { errorDetail } from "@/providers/http";
import type { UploadBackend } from "./types";

/** docs.kie.ai/file-upload-api — files are free to upload and deleted after 24 h. */
export const KIE_UPLOAD_BASE = "https://kieai.redpandaai.co";
const KIE_UPLOAD_TTL = 24 * 60 * 60 * 1000;
const SAFETY = 30 * 60 * 1000;

export const uploadToKie: UploadBackend = async (file, name, contentType, key) => {
  const form = new FormData();
  form.append("file", new File([file], name, { type: contentType }));
  form.append("uploadPath", "makeaivideos");
  form.append("fileName", name);
  const res = await fetch(`${KIE_UPLOAD_BASE}/api/file-stream-upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  const text = await res.text();
  type Envelope = { code?: number; msg?: string; data?: { downloadUrl?: string } };
  let data: Envelope | null = null;
  try {
    data = JSON.parse(text) as Envelope;
  } catch {
    data = null;
  }
  const url = data?.data?.downloadUrl;
  if (!res.ok || data?.code !== 200 || !url) {
    const code = data?.code ?? res.status;
    throw new ProviderError(`KIE upload failed (${code}). ${data?.msg ?? errorDetail(data, text)}`.trim(), code === 401 ? "auth" : "unknown", code);
  }
  return { url, expiresAt: Date.now() + KIE_UPLOAD_TTL - SAFETY };
};
