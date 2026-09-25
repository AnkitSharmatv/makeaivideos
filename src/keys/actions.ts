"use server";

import { getProvider } from "@/providers";
import { PROVIDER_IDS, isProviderId, type ProviderId } from "@/providers/types";
import { requireUser } from "@/server/auth";
import { deleteProviderKey, getProviderKey, providersWithKeys, setProviderKey } from "@/server/keys";

export type KeyStatus = Record<ProviderId, boolean>;

export async function getKeyStatus(): Promise<KeyStatus> {
  const user = await requireUser();
  const held = new Set(await providersWithKeys(user.id));
  const out = {} as KeyStatus;
  for (const id of PROVIDER_IDS) out[id] = held.has(id);
  return out;
}

export type SaveKeyResult = { ok: true } | { ok: false; status: number; reason: string };

export async function saveKey(providerId: string, rawKey: string): Promise<SaveKeyResult> {
  const user = await requireUser();
  if (!isProviderId(providerId)) return { ok: false, status: 400, reason: "Unknown provider." };
  const key = rawKey.trim();
  if (!key) return { ok: false, status: 400, reason: "Enter a key first." };
  if (key.length > 512) return { ok: false, status: 400, reason: "That doesn't look like an API key." };
  const provider = getProvider(providerId);
  if (provider.auth.pattern && !provider.auth.pattern.test(key)) {
    return { ok: false, status: 400, reason: `Expected the format ${provider.auth.placeholder}.` };
  }

  let check: Awaited<ReturnType<typeof provider.validateKey>>;
  try {
    check = await provider.validateKey(key);
  } catch (err) {
    return { ok: false, status: 0, reason: err instanceof Error ? err.message : "Could not reach the provider." };
  }
  if (!check.ok) {
    const status = check.status;
    const reason = status === 401 || status === 403 ? `Key rejected (${status}).` : `Validation failed (${status}). ${check.reason}`.trim();
    return { ok: false, status, reason };
  }

  await setProviderKey(user.id, providerId, key);
  return { ok: true };
}

export async function removeKey(providerId: string): Promise<void> {
  const user = await requireUser();
  if (!isProviderId(providerId)) return;
  await deleteProviderKey(user.id, providerId);
}

/** Server-side only: the decrypted key for the signed-in user. Never returned to the client. */
export async function readKey(providerId: ProviderId): Promise<string | null> {
  const user = await requireUser();
  return getProviderKey(user.id, providerId);
}

export type BalanceResult = { ok: true; credits?: number; usd?: number; at: number } | { ok: false; reason: string };

/** Current balance for a provider, when it exposes one. */
export async function getBalance(providerId: string): Promise<BalanceResult> {
  const user = await requireUser();
  if (!isProviderId(providerId)) return { ok: false, reason: "Unknown provider." };
  const provider = getProvider(providerId);
  if (!provider.balance) return { ok: false, reason: "Not available" };
  const key = await getProviderKey(user.id, providerId);
  if (!key) return { ok: false, reason: "No key" };
  try {
    const b = await provider.balance(key);
    if (!b) return { ok: false, reason: "Not available" };
    return { ok: true, ...b, at: Date.now() };
  } catch {
    return { ok: false, reason: "Unavailable" };
  }
}
