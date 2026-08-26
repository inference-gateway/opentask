import { describe, expect, test } from "bun:test";
import { githubError, parseGhHttp } from "../src/shared/messages";

describe("parseGhHttp", () => {
  test("parses status and body from CRLF gh api --include output", () => {
    const out = "HTTP/2.0 200 OK\r\nContent-Type: application/json\r\n\r\n{\"login\":\"me\"}";
    expect(parseGhHttp(out)).toEqual({ status: 200, body: '{"login":"me"}' });
  });

  test("parses a 404 with a JSON error body", () => {
    const out = 'HTTP/1.1 404 Not Found\nX-GitHub-Request-Id: abc\n\n{"message":"Not Found"}';
    expect(parseGhHttp(out)).toEqual({ status: 404, body: '{"message":"Not Found"}' });
  });

  test("returns an empty body for a 204 with no content", () => {
    expect(parseGhHttp("HTTP/2.0 204 No Content\nServer: GitHub.com\n")).toEqual({ status: 204, body: "" });
  });

  test("takes the last header block when gh printed one per redirect hop", () => {
    const out = "HTTP/2.0 301 Moved Permanently\nLocation: x\n\nHTTP/2.0 200 OK\nA: b\n\nbody";
    expect(parseGhHttp(out)).toEqual({ status: 200, body: "body" });
  });

  test("throws the tool error (or a gh hint) when no status line exists", () => {
    expect(() => parseGhHttp("zsh: command not found: gh", "exit 127")).toThrow("exit 127");
    expect(() => parseGhHttp("")).toThrow(/is gh installed/);
  });
});

describe("githubError", () => {
  test("surfaces GitHub's message instead of a bare status", () => {
    expect(githubError(422, JSON.stringify({ message: "Invalid tree info" })))
      .toBe("GitHub 422: Invalid tree info");
  });

  test("folds the errors array into the message", () => {
    const body = JSON.stringify({
      message: "Reference update failed",
      errors: [{ resource: "Reference", code: "custom", message: "Object does not exist" }],
    });
    expect(githubError(422, body)).toBe("GitHub 422: Reference update failed - Object does not exist");
  });

  test("describes errors that carry only a field and code", () => {
    const body = JSON.stringify({ message: "Validation Failed", errors: [{ field: "sha", code: "missing_field" }] });
    expect(githubError(422, body)).toBe("GitHub 422: Validation Failed - sha missing_field");
  });

  test("falls back to raw text, then to the bare status", () => {
    expect(githubError(502, "upstream boom")).toBe("GitHub 502: upstream boom");
    expect(githubError(502, "")).toBe("GitHub 502");
  });
});
