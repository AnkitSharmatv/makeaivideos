"use client";

import { BATCH_MAX } from "@/config";
import { useUiStore } from "@/stores/ui";

export function BatchStepper({ max = BATCH_MAX }: { max?: number }) {
  const batch = useUiStore((s) => s.batch);
  const setBatch = useUiStore((s) => s.setBatch);
  const value = Math.min(batch, max);

  return (
    <div className="stepper" role="group" aria-label="Batch size">
      <span className="stepper-label">Batch</span>
      <button type="button" aria-label="Fewer" disabled={value <= 1} onClick={() => setBatch(value - 1)}>
        −
      </button>
      <span className="stepper-value" aria-live="polite">
        {value}
      </span>
      <button type="button" aria-label="More" disabled={value >= max} onClick={() => setBatch(value + 1)}>
        +
      </button>
    </div>
  );
}
