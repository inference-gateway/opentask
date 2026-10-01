import { describe, expect, test } from "bun:test";
import { MAX_ATTACHMENTS, parseAttachments, userMessageContent } from "../src/shared/agui";

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

describe("userMessageContent", () => {
  test("a plain string without attachments", () => {
    expect(userMessageContent("hi", [])).toBe("hi");
  });

  test("text and image parts in the CLI's shape", () => {
    expect(userMessageContent("look", [{ filename: "photo.png", mime_type: "image/png", data: "BBBB" }])).toEqual([
      { type: "text", text: "look" },
      { type: "image", mimeType: "image/png", data: "BBBB", filename: "photo.png" },
    ]);
  });

  test("no text part when the message is only files", () => {
    expect(userMessageContent("", [valid])).toEqual([{ type: "image", mimeType: valid.mime_type, data: valid.data, filename: valid.filename }]);
  });
});
