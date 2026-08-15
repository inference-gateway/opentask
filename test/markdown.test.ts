import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Markdown } from "../src/lib/markdown";

const html = (text: string) => renderToStaticMarkup(Markdown({ text }) as never);

test("renders inline formatting", () => {
  const out = html("**bold** and *italic* and `code`");
  expect(out).toContain("<strong>bold</strong>");
  expect(out).toContain("<em>italic</em>");
  expect(out).toContain("<code");
  expect(out).toContain("code</code>");
});

test("renders fenced code blocks", () => {
  const out = html("```\nconst x = 1;\n```");
  expect(out).toContain("<pre");
  expect(out).toContain("const x = 1;");
});

test("renders lists and headings", () => {
  expect(html("# Title")).toContain("Title");
  expect(html("- a\n- b")).toContain("<ul");
  expect(html("1. a\n2. b")).toContain("<ol");
});

test("links are safe and only http(s) passes through", () => {
  expect(html("[ok](https://x.com)")).toContain('href="https://x.com"');
  expect(html("[x](javascript:alert(1))")).toContain('href="#"');
});

test("no raw HTML injection", () => {
  const out = html("<img src=x onerror=alert(1)>");
  expect(out).not.toContain("<img");
  expect(out).toContain("&lt;img");
});
