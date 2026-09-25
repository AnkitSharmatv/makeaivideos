import "server-only";
import { all, one, run } from "./db";
import { decrypt, encrypt } from "./crypto";
import type { ProviderId } from "@/providers/types";

export async function getProviderKey(userId: string, provider: ProviderId): Promise<string | null> {
  const r = await one<{ ciphertext: string }>("SELECT ciphertext FROM provider_keys WHERE user_id = ? AND provider = ?", [userId, provider]);
  if (!r) return null;
  try {
    return decrypt(r.ciphertext);
  } catch {
    // Secret changed since the key was stored; treat as missing.
    return null;
  }
}

export async function setProviderKey(userId: string, provider: ProviderId, key: string): Promise<void> {
  await run(
    "INSERT INTO provider_keys (user_id, provider, ciphertext, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, provider) DO UPDATE SET ciphertext = excluded.ciphertext, updated_at = excluded.updated_at",
    [userId, provider, encrypt(key), Date.now()],
  );
}

export async function deleteProviderKey(userId: string, provider: ProviderId): Promise<void> {
  await run("DELETE FROM provider_keys WHERE user_id = ? AND provider = ?", [userId, provider]);
}

export async function providersWithKeys(userId: string): Promise<ProviderId[]> {
  const rows = await all<{ provider: ProviderId }>("SELECT provider FROM provider_keys WHERE user_id = ?", [userId]);
  return rows.map((r) => r.provider);
}
