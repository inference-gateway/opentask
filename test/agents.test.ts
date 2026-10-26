import { expect, test } from "bun:test";
import { agentsFromCatalog, isAgentManifest, type AgentManifest } from "../src/shared/agents";

const agent = (over: Partial<AgentManifest>): AgentManifest => ({
  metadata: { name: "test-agent", description: "A test agent", version: "1.0.0" },
  _source: { repo: "inference-gateway/agents", ref: "main" },
  ...over,
});

test("isAgentManifest requires metadata with name, description, and version strings", () => {
  expect(isAgentManifest(agent({}))).toBe(true);
  expect(
    isAgentManifest({ metadata: { name: "a", description: "b", version: "c" }, _source: { repo: "r", ref: "m" } })
  ).toBe(true);
});

test("isAgentManifest rejects null and non-objects", () => {
  expect(isAgentManifest(null)).toBe(false);
  expect(isAgentManifest(undefined)).toBe(false);
  expect(isAgentManifest("string")).toBe(false);
  expect(isAgentManifest(42)).toBe(false);
});

test("isAgentManifest rejects missing metadata fields", () => {
  expect(isAgentManifest({ metadata: { name: "a", description: "b" } })).toBe(false);
  expect(isAgentManifest({ metadata: { name: "a", version: "c" } })).toBe(false);
  expect(isAgentManifest({ metadata: { description: "b", version: "c" } })).toBe(false);
  expect(isAgentManifest({})).toBe(false);
});

test("isAgentManifest rejects non-object metadata", () => {
  expect(isAgentManifest({ metadata: "string" })).toBe(false);
  expect(isAgentManifest({ metadata: null })).toBe(false);
});

test("agentsFromCatalog extracts agents from the wrapper object and a bare array", () => {
  const a = { metadata: { name: "browser-agent", description: "d", version: "0.6.4" }, spec: {} };
  expect(agentsFromCatalog({ version: 1, agents: [a] }).map((x) => x.metadata.name)).toEqual(["browser-agent"]);
  expect(agentsFromCatalog([a])).toHaveLength(1);
  expect(agentsFromCatalog({})).toEqual([]);
});
