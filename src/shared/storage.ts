import { DEFAULT_BOT, isBotConfig, type BotConfig } from "./models";

// The only chrome.* surface besides runtime messaging, isolated here so a future
// browser port swaps one file (or drops in webextension-polyfill). Every accessor
// tolerates an invalidated extension context (stale content script after a reload),
// where chrome.storage is undefined - it degrades to a no-op instead of throwing.
export function get<T>(key: string): Promise<T | undefined> {
  const area = chrome?.storage?.local;
  if (!area) return Promise.resolve(undefined);
  return area.get(key).then((o) => o[key] as T | undefined);
}

export function set(key: string, value: unknown): Promise<void> {
  const area = chrome?.storage?.local;
  if (!area) return Promise.resolve();
  return area.set({ [key]: value });
}

export function remove(key: string): Promise<void> {
  const area = chrome?.storage?.local;
  if (!area) return Promise.resolve();
  return area.remove(key);
}

// A GitHub App identity keyed by repo owner. owner === "" is the
// default/fallback. A GitHub App is owned by one account/org, so this must be per-owner.
export type BotEntry = { owner: string } & BotConfig;

// Reads the "bots" list. Migrates the legacy single "bot" object on read into one
// default (blank-owner) entry.
export async function loadBots(): Promise<BotEntry[]> {
  const stored = await get<BotEntry[]>("bots");
  if (Array.isArray(stored) && stored.length) return stored;
  const legacy = await get<unknown>("bot");
  return isBotConfig(legacy) ? [{ owner: "", ...legacy }] : [];
}

// Persists the list, dropping rows that are disabled and empty, and clearing the
// legacy "bot" key so it can't drift out of sync with "bots".
export async function saveBots(entries: BotEntry[]): Promise<void> {
  const clean = entries
    .map((e) => ({ owner: e.owner.trim(), enabled: e.enabled, clientId: e.clientId.trim(), privateKeySecret: e.privateKeySecret.trim() }))
    .filter((e) => e.owner && (e.enabled || e.clientId));
  await set("bots", clean);
  await remove("bot");
}

// Selects the bot config for an owner by exact match, else DEFAULT_BOT.
export function botFor(owner: string, entries: BotEntry[]): BotConfig {
  const e = entries.find((x) => x.owner === owner);
  return e ? { enabled: e.enabled, clientId: e.clientId, privateKeySecret: e.privateKeySecret } : DEFAULT_BOT;
}
