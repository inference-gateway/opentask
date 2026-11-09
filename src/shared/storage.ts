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

// The CLI bridge settings the extension dials the infer daemon with, blank when
// unset. policyManaged marks a token supplied by enterprise policy, the sign of an
// unattended browser that should connect without a click.
export interface BridgeSettings {
  port: string;
  token: string;
  projectDir: string;
  policyManaged: boolean;
}

export async function bridgeSettings(): Promise<BridgeSettings> {
  const [port, token, projectDir, policyToken] = await Promise.all([
    readSetting("bridge-port"),
    readSetting("bridge-token"),
    readSetting("bridge-project-dir"),
    readManagedSetting("bridge-token"),
  ]);
  return { port, token, projectDir, policyManaged: policyToken !== "" };
}

// A value stored locally wins, so the options page can override what policy sets.
async function readSetting(key: string): Promise<string> {
  return (await readLocalSetting(key)) || readManagedSetting(key);
}

async function readLocalSetting(key: string): Promise<string> {
  return ((await get<string>(key)) ?? "").trim();
}

// Reads enterprise policy (Firefox 3rdparty.Extensions, Chrome 3rdparty.extensions).
// Chrome throws without a managed_schema and some browsers lack the area - both read
// as unset.
async function readManagedSetting(key: string): Promise<string> {
  try {
    const values = await chrome.storage.managed.get(key);
    return String(values[key] ?? "").trim();
  } catch {
    return "";
  }
}
