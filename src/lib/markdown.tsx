import type { ReactNode } from "react";

// ponytail: minimal agent-chat markdown, not CommonMark. XSS-safe by construction —
// builds React elements, never innerHTML. Swap for `marked`+sanitizer if we ever
// need tables/nested lists/HTML passthrough.

// Inline: `code`, **bold**, *italic* / _italic_, [text](url). Ordered by precedence.
const INLINE = [
  { re: /`([^`]+)`/, render: (m: string, k: number) => <code key={k} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">{m}</code> },
  { re: /\*\*([^*]+)\*\*/, render: (m: string, k: number) => <strong key={k}>{m}</strong> },
  { re: /(?:\*([^*]+)\*|_([^_]+)_)/, render: (m: string, k: number) => <em key={k}>{m}</em> },
] as const;

const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/;

function inline(text: string, keyBase = 0): ReactNode[] {
  const linkMatch = LINK.exec(text);
  if (linkMatch) {
    const [full, label, href] = linkMatch;
    const start = linkMatch.index;
    const safe = /^https?:\/\//i.test(href) ? href : "#";
    return [
      ...inline(text.slice(0, start), keyBase),
      <a key={`l${keyBase}`} href={safe} target="_blank" rel="noreferrer" className="text-indigo-500 underline underline-offset-2 hover:text-indigo-400">{label}</a>,
      ...inline(text.slice(start + full.length), keyBase + 1000),
    ];
  }
  for (const { re, render } of INLINE) {
    const m = re.exec(text);
    if (!m) continue;
    const captured = m.slice(1).find((g) => g != null) ?? "";
    return [
      ...inline(text.slice(0, m.index), keyBase),
      render(captured, keyBase),
      ...inline(text.slice(m.index + m[0].length), keyBase + 1000),
    ];
  }
  return text ? [text] : [];
}

export function Markdown({ text }: { text: string }): ReactNode {
  const blocks: ReactNode[] = [];
  const lines = text.split("\n");
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("```")) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) body.push(lines[i++]);
      i++;
      blocks.push(
        <pre key={key++} className="overflow-x-auto rounded-lg bg-muted/70 p-2.5 font-mono text-[0.85em] leading-relaxed">
          <code>{body.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const size = h[1].length <= 2 ? "text-base" : "text-sm";
      blocks.push(<p key={key++} className={`font-semibold ${size}`}>{inline(h[2])}</p>);
      i++;
      continue;
    }

    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const items: ReactNode[] = [];
      const ordered = /^\s*\d+\.\s+/.test(line);
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        const content = lines[i].replace(/^\s*([-*]|\d+\.)\s+/, "");
        items.push(<li key={items.length}>{inline(content)}</li>);
        i++;
      }
      blocks.push(
        ordered
          ? <ol key={key++} className="list-decimal space-y-0.5 pl-5">{items}</ol>
          : <ul key={key++} className="list-disc space-y-0.5 pl-5">{items}</ul>,
      );
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("```") &&
      !/^(#{1,6})\s+/.test(lines[i]) &&
      !/^\s*([-*]|\d+\.)\s+/.test(lines[i])
    ) {
      para.push(lines[i++]);
    }
    blocks.push(<p key={key++} className="whitespace-pre-wrap">{inline(para.join("\n"))}</p>);
  }

  return <div className="space-y-2">{blocks}</div>;
}
