import DOMPurify from "dompurify";
import { Marked } from "marked";
import type { ReactNode } from "react";

// Full GFM rendering (tables, nested lists, strikethrough) via marked, sanitized
// with DOMPurify. Raw HTML in the source is escaped, never passed through; link
// and image URLs are vetted in the renderer before sanitization. Element styling
// lives in src/ui/globals.css under `.md`.

// The CLI saves generated images to ~/.infer/artifacts/<...> and only sends the
// local path. An MV3 extension can't load a file path, so rewrite it onto the
// bridge's HTTP artifact route; otherwise only http(s)/data:image URLs are allowed.
let artifactBase = "";
function resolveImg(url: string): string | undefined {
  const art = /\/\.infer\/artifacts\/(.+)$/.exec(url);
  const src = art && artifactBase ? `${artifactBase}/artifacts/${art[1]}` : url;
  return /^https?:\/\//i.test(src) || /^data:image\//i.test(src) ? src : undefined;
}

// A bare artifact image path (what ImageGeneration prints) auto-previews as an
// image, so the panel shows the result without the model wrapping it in ![](…).
const ARTIFACT_IMG = /\/\.infer\/artifacts\/.+\.(?:png|jpe?g|gif|webp)$/i;
function artifactImg(raw: string): string | undefined {
  const t = raw.trim();
  return ARTIFACT_IMG.test(t) ? resolveImg(t) : undefined;
}

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function img(src: string, alt: string): string {
  return `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy">`;
}

const marked = new Marked({
  gfm: true,
  breaks: true,
  renderer: {
    html({ raw }) {
      return esc(raw);
    },
    codespan({ text }) {
      const src = artifactImg(text);
      return src ? img(src, text) : `<code>${esc(text)}</code>`;
    },
    link({ href, tokens }) {
      const safe = /^https?:\/\//i.test(href) ? href : "#";
      return `<a href="${esc(safe)}" target="_blank" rel="noreferrer">${this.parser.parseInline(tokens)}</a>`;
    },
    image({ href, text }) {
      const src = resolveImg(href);
      return src ? img(src, text) : esc(text);
    },
  },
});

export function Markdown({ text, artifactBase: base = "" }: { text: string; artifactBase?: string }): ReactNode {
  artifactBase = base;
  const raw = marked.parse(text, { async: false }) as string;
  const safe = DOMPurify.sanitize(raw, { ADD_ATTR: ["target"] });
  return <div className="md" dangerouslySetInnerHTML={{ __html: safe }} />;
}
