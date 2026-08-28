import { expect, test } from "bun:test";
import { MODELS, DEFAULT_BOT, DEFAULT_PERMISSIONS, DEFAULT_PLUGINS, DEFAULT_DEPENDENCIES, DEPENDENCY_DEFS, isBotConfig, isPermissions, isPluginOption, isDependenciesConfig, enabledPlugins, githubAppUrl } from "../src/shared/models";

const noBot = DEFAULT_BOT;
const bot = { enabled: true, clientId: "Iv23liABC", privateKeySecret: "OPENTASK_APP_PRIVATE_KEY" };

test("githubAppUrl uses the org path only for an org owner, personal path otherwise", () => {
  expect(githubAppUrl("acme", true).startsWith("https://github.com/organizations/acme/settings/apps/new?")).toBe(true);
  expect(githubAppUrl("edenreich", false).startsWith("https://github.com/settings/apps/new?")).toBe(true);
  expect(githubAppUrl("", false).startsWith("https://github.com/settings/apps/new?")).toBe(true);
});

test("githubAppUrl disables the webhook and sets a Homepage url", () => {
  const p = new URL(githubAppUrl("acme", true)).searchParams;
  expect(p.get("webhook_active")).toBe("false");
  expect(p.get("url")).toBe("https://github.com/acme");
  expect(new URL(githubAppUrl("", false)).searchParams.get("url")).toBeTruthy();
});

test("isPermissions accepts a full config and rejects malformed ones", () => {
  expect(isPermissions(DEFAULT_PERMISSIONS)).toBe(true);
  expect(isPermissions({ createPRs: true, createIssues: false, comment: true })).toBe(true);
  expect(isPermissions({ createPRs: true, createIssues: false })).toBe(false);
  expect(isPermissions(null)).toBe(false);
});

test("MODELS are provider-prefixed ids and none is empty", () => {
  expect(MODELS.length).toBeGreaterThan(0);
  expect(MODELS.every((m) => /^[a-z0-9_]+\/.+/.test(m))).toBe(true);
  expect(new Set(MODELS).size).toBe(MODELS.length);
});

test("isBotConfig accepts a full config and rejects malformed ones", () => {
  expect(isBotConfig(DEFAULT_BOT)).toBe(true);
  expect(isBotConfig({ enabled: true, clientId: "a", privateKeySecret: "b" })).toBe(true);
  expect(isBotConfig({ enabled: "yes", clientId: "a", privateKeySecret: "b" })).toBe(false);
  expect(isBotConfig(null)).toBe(false);
});

test("DEFAULT_PLUGINS are the three known plugins, all disabled by default", () => {
  expect(DEFAULT_PLUGINS.map((p) => p.id)).toEqual([
    "juliusbrussee/caveman",
    "DietrichGebert/ponytail",
    "ayghri/i-have-adhd",
  ]);
  expect(DEFAULT_PLUGINS.every((p) => p.enabled === false)).toBe(true);
});

test("enabledPlugins returns only toggled-on ids", () => {
  expect(enabledPlugins(DEFAULT_PLUGINS)).toEqual([]);
  expect(
    enabledPlugins([
      { id: "a/b", enabled: true },
      { id: "c/d", enabled: false },
      { id: "e/f", enabled: true },
    ]),
  ).toEqual(["a/b", "e/f"]);
});

test("isPluginOption accepts a valid option and rejects bad shapes", () => {
  expect(isPluginOption({ id: "a/b", enabled: true })).toBe(true);
  expect(isPluginOption({ id: "a/b", enabled: "yes" })).toBe(false);
  expect(isPluginOption({ id: 1, enabled: true })).toBe(false);
  expect(isPluginOption(null)).toBe(false);
});

test("DEFAULT_DEPENDENCIES enables only task, auto-detect off", () => {
  expect(DEFAULT_DEPENDENCIES.autoDetect).toBe(false);
  expect(DEFAULT_DEPENDENCIES.items.filter((d) => d.enabled).map((d) => d.id)).toEqual(["task"]);
});

test("Rust allow regexes match cargo miri, cargo clippy, cargo, and rustup component add miri", () => {
  const rust = DEPENDENCY_DEFS.find((d) => d.id === "rust")!;
  const cargoRe = new RegExp(`^${rust.allow!.find((a) => a.startsWith("cargo"))!}$`);
  const rustupRe = new RegExp(`^${rust.allow!.find((a) => a.startsWith("rustup"))!}$`);
  expect(cargoRe.test("cargo miri test")).toBe(true);
  expect(cargoRe.test("cargo clippy")).toBe(true);
  expect(cargoRe.test("cargo")).toBe(true);
  expect(rustupRe.test("rustup component add miri")).toBe(true);
  expect(rustupRe.test("rustup")).toBe(true);
  expect(cargoRe.test("rustup component add miri")).toBe(false);
});

test("isDependenciesConfig accepts a valid config and rejects bad shapes", () => {
  expect(isDependenciesConfig(DEFAULT_DEPENDENCIES)).toBe(true);
  expect(isDependenciesConfig({ autoDetect: true, items: [] })).toBe(true);
  expect(isDependenciesConfig({ autoDetect: true, apt: 7, items: [] })).toBe(false);
  expect(isDependenciesConfig({ autoDetect: "yes", items: [] })).toBe(false);
  expect(isDependenciesConfig({ autoDetect: true, items: [{ id: "go" }] })).toBe(false);
  expect(isDependenciesConfig({ autoDetect: true })).toBe(false);
  expect(isDependenciesConfig(null)).toBe(false);
});
