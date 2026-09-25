import type { LampState } from "@/stores/ui";

const LABELS: Record<LampState, string> = {
  none: "No key",
  held: "Key held",
  live: "Generating",
  error: "Error",
};

export function Lamp({ state, label }: { state: LampState; label?: string }) {
  return (
    <span className="lamp" data-state={state} role="status" aria-live="polite">
      <i aria-hidden="true" />
      <span>{label ?? LABELS[state]}</span>
    </span>
  );
}
