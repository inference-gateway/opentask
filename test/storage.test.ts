import { beforeEach, expect, test } from "bun:test";
import * as storage from "../src/shared/storage";

let store: Record<string, unknown>;
let policy: Record<string, unknown>;

beforeEach(() => {
  store = {};
  policy = {};
  (globalThis as Record<string, unknown>).chrome = {
    storage: {
      local: {
        get: async (key: string) => (key in store ? { [key]: store[key] } : {}),
        set: async (obj: Record<string, unknown>) => {
          Object.assign(store, obj);
        },
        remove: async (key: string) => {
          delete store[key];
        },
      },
      managed: {
        get: async (key: string) => (key in policy ? { [key]: policy[key] } : {}),
      },
    },
  };
});

test("set then get round-trips a value", async () => {
  await storage.set("key", "value-1");
  expect(await storage.get<string>("key")).toBe("value-1");
});

test("remove deletes the key", async () => {
  await storage.set("key", "value-1");
  await storage.remove("key");
  expect(await storage.get<string>("key")).toBeUndefined();
});

test("bridge settings stored locally win over policy", async () => {
  store = { "bridge-port": "1111", "bridge-token": "local-token", "bridge-project-dir": "/local" };
  policy = { "bridge-port": "2222", "bridge-token": "policy-token", "bridge-project-dir": "/policy" };
  expect(await storage.bridgeSettings()).toEqual({
    port: "1111",
    token: "local-token",
    projectDir: "/local",
    policyManaged: true,
  });
});

test("uses the policy settings when none are stored locally", async () => {
  store = { "bridge-token": "  " };
  policy = { "bridge-port": "52790", "bridge-token": "policy-token", "bridge-project-dir": "/workspace" };
  expect(await storage.bridgeSettings()).toEqual({
    port: "52790",
    token: "policy-token",
    projectDir: "/workspace",
    policyManaged: true,
  });
});

test("reads no policy when managed storage throws", async () => {
  store = { "bridge-token": "local-token" };
  Object.assign(chrome.storage, {
    managed: {
      get: async () => {
        throw new Error("Managed storage manifest not found");
      },
    },
  });
  expect(await storage.bridgeSettings()).toEqual({
    port: "",
    token: "local-token",
    projectDir: "",
    policyManaged: false,
  });
});
