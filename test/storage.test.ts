import { beforeEach, expect, test } from "bun:test";
import * as storage from "../src/shared/storage";

let store: Record<string, unknown>;

beforeEach(() => {
  store = {};
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

