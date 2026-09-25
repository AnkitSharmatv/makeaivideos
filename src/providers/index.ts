import type { ModelSpec, Provider, ProviderId } from "./types";
import { kie } from "./kie";
import { fal } from "./fal";
import { higgsfield } from "./higgsfield";

const REGISTRY: Record<ProviderId, Provider> = { kie, fal, higgsfield };

export function getProvider(id: ProviderId): Provider {
  return REGISTRY[id];
}

export function allProviders(): Provider[] {
  return [kie, fal, higgsfield];
}

/** Flat catalog across providers. Model ids are unique per provider only. */
export function allModels(): ModelSpec[] {
  return allProviders().flatMap((p) => p.catalog);
}

export function modelKey(m: Pick<ModelSpec, "provider" | "id">): string {
  return `${m.provider}:${m.id}`;
}

export function findModel(key: string): ModelSpec | undefined {
  const i = key.indexOf(":");
  if (i < 0) return undefined;
  const provider = key.slice(0, i);
  const id = key.slice(i + 1);
  return allModels().find((m) => m.provider === provider && m.id === id);
}
