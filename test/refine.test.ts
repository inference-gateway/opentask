import { expect, test } from "bun:test";
import { refinePrompt } from "../src/shared/task";
import { isRefineConfig, DEFAULT_REFINE } from "../src/shared/models";
import { issueFromUrl } from "../src/lib/dom";

test("refinePrompt names the issue and edits in place", () => {
  const p = refinePrompt("octo", "repo", 11);
  expect(p).toContain("#11");
  expect(p).toContain("octo/repo");
  expect(p).toContain("gh issue edit 11");
});

test("refinePrompt substitutes placeholders in a custom template", () => {
  expect(refinePrompt("octo", "repo", 11, "fix {owner}/{repo}#{issue} now {issue}")).toBe("fix octo/repo#11 now 11");
});

test("isRefineConfig accepts the default and rejects malformed input", () => {
  expect(isRefineConfig(DEFAULT_REFINE)).toBe(true);
  expect(isRefineConfig({ auto: true, manual: false })).toBe(true);
  expect(isRefineConfig({ auto: true })).toBe(false);
  expect(isRefineConfig({ auto: "yes", manual: false })).toBe(false);
  expect(isRefineConfig(null)).toBe(false);
});

function at(pathname: string): ReturnType<typeof issueFromUrl> {
  (globalThis as { location?: Location }).location = { pathname } as Location;
  return issueFromUrl();
}

test("issueFromUrl parses issue pages, ignores PRs and repo roots", () => {
  expect(at("/octo/repo/issues/12")).toEqual({ owner: "octo", repo: "repo", issue: 12 });
  expect(at("/octo/repo/issues/12/anything")).toEqual({ owner: "octo", repo: "repo", issue: 12 });
  expect(at("/octo/repo/pull/12")).toBeNull();
  expect(at("/octo/repo")).toBeNull();
  expect(at("/orgs/repo/issues/12")).toBeNull();
});
