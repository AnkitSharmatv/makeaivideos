import type { GenerateInput } from "../types";

export const input = (modelId: string, extra: Partial<GenerateInput> = {}): GenerateInput => ({
  modelId,
  prompt: "a red kite over a grey beach",
  media: {},
  settings: {},
  ...extra,
});

/** Recorded response shapes, transcribed from each provider's docs. */
export const KIE_RECORD_SUCCESS = {
  taskId: "task_123",
  model: "google/nano-banana",
  state: "success",
  resultJson: JSON.stringify({ resultUrls: ["https://cdn.kie.ai/a.png", "https://cdn.kie.ai/b.png"] }),
  failCode: "",
  failMsg: "",
  costTime: 15000,
  progress: 100,
};

export const FAL_IMAGE_RESULT = {
  images: [{ url: "https://fal.media/x.jpeg", width: 1024, height: 768, content_type: "image/jpeg" }],
  seed: 42,
  has_nsfw_concepts: [false],
  prompt: "a red kite",
};

export const FAL_VIDEO_RESULT = { video: { url: "https://fal.media/v.mp4", content_type: "video/mp4" } };

export const HF_STATUS_COMPLETED_IMAGE = {
  status: "completed",
  request_id: "d7e6c0f3-6699-4f6c-bb45-2ad7fd9158ff",
  images: [{ url: "https://cdn.higgsfield.ai/1.jpg" }, { url: "https://cdn.higgsfield.ai/2.jpg" }],
};

export const HF_STATUS_COMPLETED_VIDEO = {
  status: "completed",
  request_id: "d7e6c0f3-6699-4f6c-bb45-2ad7fd9158ff",
  video: { url: "https://cdn.higgsfield.ai/v.mp4" },
};
