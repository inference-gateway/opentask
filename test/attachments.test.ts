import { describe, expect, test } from "bun:test";
import { attachmentLine, MAX_ATTACHMENTS, parseAttachments } from "../src/shared/agui";

const valid = { filename: "resume.pdf", mime_type: "application/pdf", data: "AAAA" };

describe("parseAttachments", () => {
  test("keeps well-formed attachments", () => {
    expect(parseAttachments([valid])).toEqual([valid]);
  });

  test("drops non-objects and entries without usable strings", () => {
    expect(
      parseAttachments([
        null,
        "attachment",
        {},
        { filename: "a", mime_type: "", data: "AA" },
        { filename: "", mime_type: "text/plain", data: "AA" },
        { filename: "a", mime_type: "text/plain", data: "" },
      ]),
    ).toEqual([]);
  });

  test("ignores a non-array", () => {
    expect(parseAttachments(undefined)).toEqual([]);
    expect(parseAttachments({ filename: "a", mime_type: "t", data: "AA" })).toEqual([]);
  });

  test("stops at the count cap", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ ...valid, filename: `f${i}.pdf` }));
    const out = parseAttachments(many);
    expect(out.length).toBe(MAX_ATTACHMENTS);
    expect(out[0].filename).toBe("f0.pdf");
  });

  test("drops data over the per-file byte cap but keeps the rest", () => {
    const big = { filename: "big.bin", mime_type: "application/octet-stream", data: "A".repeat(Math.ceil((10 * 1024 * 1024) / 3) * 4 + 1) };
    const out = parseAttachments([big, valid]);
    expect(out).toEqual([valid]);
  });
});

describe("attachmentLine", () => {
  test("empty when nothing attached", () => {
    expect(attachmentLine([])).toBe("");
  });

  test("names each attachment with its mime type", () => {
    expect(
      attachmentLine([valid, { filename: "photo.png", mime_type: "image/png", data: "BBBB" }]),
    ).toBe("[attached: resume.pdf (application/pdf), photo.png (image/png)]");
  });
});
