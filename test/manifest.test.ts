import { expect, test } from "bun:test";
import firefoxManifest from "../manifest.firefox.json";

test("the Firefox build keeps the bridge's ws:// to the daemon from being upgraded to wss://", () => {
  const extensionPages = firefoxManifest.content_security_policy.extension_pages;
  expect(extensionPages).toContain("script-src 'self'");
  expect(extensionPages).not.toContain("upgrade-insecure-requests");
});
