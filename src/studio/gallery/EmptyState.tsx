"use client";

import { usePromptStore } from "@/stores/prompt";

type Props = {
  title: string;
  body: string;
  action?: { label: string; starter?: string; onClick?: () => void };
};

export function EmptyState({ title, body, action }: Props) {
  const seedPrompt = usePromptStore((s) => s.seedPrompt);
  return (
    <div className="empty">
      <h2>{title}</h2>
      <p>{body}</p>
      {action ? (
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            if (action.starter) seedPrompt(action.starter);
            action.onClick?.();
          }}
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}

export const STARTERS = {
  image: "Editorial portrait of a ceramicist in her studio, late afternoon window light, shallow depth of field, muted earth tones, 85mm",
  video: "Slow dolly-in on a paper lantern swaying above a night market stall, steam rising, warm tungsten light, handheld feel",
};
