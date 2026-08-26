import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Markdown } from "../src/lib/markdown";

const html = (text: string, artifactBase?: string) =>
  renderToStaticMarkup(Markdown({ text, artifactBase }) as never);

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

test("renders http(s)/data images, rewrites artifact paths, drops unsafe src", () => {
  expect(html("![cat](https://x.com/c.png)")).toContain('<img');
  expect(html("![cat](https://x.com/c.png)")).toContain('src="https://x.com/c.png"');
  expect(html("![cat](/Users/e/.infer/artifacts/u1/image-9.png)", "http://127.0.0.1:52789")).toContain(
    'src="http://127.0.0.1:52789/artifacts/u1/image-9.png"',
  );
  expect(html("![x](javascript:alert(1))")).not.toContain("<img");
  expect(html("![x](/Users/e/.infer/artifacts/u1/i.png)")).not.toContain("<img");
});

test("auto-embeds a bare artifact image path in inline code", () => {
  const withBase = html("Saved to: `/Users/e/.infer/artifacts/u1/image-9.png`", "http://127.0.0.1:52789");
  expect(withBase).toContain("<img");
  expect(withBase).toContain('src="http://127.0.0.1:52789/artifacts/u1/image-9.png"');

  const noBase = html("Saved to: `/Users/e/.infer/artifacts/u1/image-9.png`");
  expect(noBase).not.toContain("<img");
  expect(noBase).toContain("<code");

  expect(html("run `npm run build` now", "http://127.0.0.1:52789")).not.toContain("<img");
});

test("renders GFM tables", () => {
  const out = html("| Requested | Status |\n|---|---|\n| `timeout` | ok |");
  expect(out).toContain("<table");
  expect(out).toContain("<th>Requested</th>");
  expect(out).toContain("<code>timeout</code>");
});

test("renders bold spans containing inline code", () => {
  const out = html("**GitHub App token: secret `KEY` changed**");
  expect(out).toContain("<strong>");
  expect(out).toContain("<code>KEY</code>");
  expect(out).not.toContain("**");
});

test("no raw HTML injection", () => {
  const out = html("<img src=x onerror=alert(1)>");
  expect(out).not.toContain("<img");
  expect(out).toContain("&lt;img");
});
