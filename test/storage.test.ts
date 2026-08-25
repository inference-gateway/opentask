import { beforeEach, expect, test } from "bun:test";
import * as storage from "../src/shared/storage";
import { DEFAULT_BOT } from "../src/shared/models";

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

const acmeBot = { enabled: true, clientId: "Iv1", privateKeySecret: "ACME_KEY" };

test("botFor picks the exact owner match, else DEFAULT_BOT", () => {
  const entries = [{ owner: "acme", ...acmeBot }];
  expect(storage.botFor("acme", entries)).toEqual(acmeBot);
  expect(storage.botFor("other", entries)).toEqual(DEFAULT_BOT);
  expect(storage.botFor("acme", [])).toEqual(DEFAULT_BOT);
});

test("saveBots trims, drops empty disabled rows, and clears the legacy bot key", async () => {
  await storage.set("bot", { enabled: true, clientId: "old", privateKeySecret: "OLD" });
  await storage.saveBots([
    { owner: "  acme ", enabled: true, clientId: "  Iv1  ", privateKeySecret: " ACME_KEY " },
    { owner: "empty", enabled: false, clientId: "  ", privateKeySecret: "APP_PRIVATE_KEY" },
    { owner: "keep", enabled: false, clientId: "Iv2", privateKeySecret: "K" },
  ]);
  expect(await storage.get<storage.BotEntry[]>("bots")).toEqual([
    { owner: "acme", enabled: true, clientId: "Iv1", privateKeySecret: "ACME_KEY" },
    { owner: "keep", enabled: false, clientId: "Iv2", privateKeySecret: "K" },
  ]);
  expect(await storage.get("bot")).toBeUndefined();
});

test("loadBots migrates a legacy bot object into a blank-owner entry", async () => {
  await storage.set("bot", acmeBot);
  expect(await storage.loadBots()).toEqual([{ owner: "", ...acmeBot }]);
});

test("loadBots prefers the bots list over the legacy bot", async () => {
  await storage.set("bot", { enabled: true, clientId: "legacy", privateKeySecret: "L" });
  await storage.set("bots", [{ owner: "acme", ...acmeBot }]);
  expect(await storage.loadBots()).toEqual([{ owner: "acme", ...acmeBot }]);
});
