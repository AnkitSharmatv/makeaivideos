import type { FailureCode, GenerateInput, MediaKind, MediaRole, ProviderId, SettingValue } from "@/providers/types";

/**
 * What the composer holds in a media slot. Resolved to a public URL for the
 * target provider at submit time (uploads are re-sent when their URL expired).
 */
export type MediaRef = { type: "upload"; id: string } | { type: "asset"; id: string } | { type: "url"; url: string };
export type MediaRefs = Partial<Record<MediaRole, MediaRef[]>>;

export type Project = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
};

/** One finished output. The gallery renders one tile per asset. */
export type Asset = {
  id: string;
  projectId: string;
  runId: string;
  provider: ProviderId;
  modelId: string;
  kind: MediaKind;
  prompt: string;
  negativePrompt?: string;
  settings: Record<string, SettingValue>;
  media: GenerateInput["media"];
  /** What was attached, so Reuse can restore re-uploadable items. */
  mediaRefs?: MediaRefs;
  seed?: number;
  /** Provider CDN URL (may expire). */
  url: string;
  /** Local copy under data/media, when the instance keeps one. */
  localFile?: string;
  /** JPEG thumbnail under data/thumbs (images). */
  thumbFile?: string;
  width?: number;
  height?: number;
  duration?: number;
  createdAt: number;
  /** What the provider reported charging for the run this asset came from (whole run, not per output). */
  costCredits?: number;
  costUsd?: number;
  /** 1 = favorite. Stored as a number so it can be indexed. */
  favorite: 0 | 1;
};

export type RunStatus = "queued" | "running" | "failed";

/** An in-flight or failed job. Done runs become assets and are removed. */
export type Run = {
  id: string;
  projectId: string;
  provider: ProviderId;
  modelId: string;
  kind: MediaKind;
  input: GenerateInput;
  mediaRefs?: MediaRefs;
  /** Expected outputs (native batch count), for skeleton sizing. */
  count: number;
  jobId?: string;
  status: RunStatus;
  progress?: number;
  error?: string;
  errorCode?: FailureCode;
  createdAt: number;
  updatedAt: number;
};

/** A file added to a project. Bytes live under data/uploads on the server; provider copies are temporary. */
export type Upload = {
  id: string;
  /** The project this input was added to. */
  projectId: string;
  kind: MediaKind;
  name: string;
  type: string;
  size: number;
  /** Stored file name under data/uploads. */
  file: string;
  width?: number;
  height?: number;
  duration?: number;
  /** Public URL per provider, with the time it stops being trustworthy. */
  remotes: Partial<Record<ProviderId, { url: string; expiresAt: number }>>;
  createdAt: number;
};

export type PromptEntry = {
  text: string;
  lastUsedAt: number;
  uses: number;
};
