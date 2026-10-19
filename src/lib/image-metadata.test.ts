import { describe, expect, it } from "vitest";
import { sniffImage, stripMetadata } from "@/lib/image-metadata";

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap((part) => (typeof part === "string" ? [...part].map((c) => c.charCodeAt(0)) : part)));
const has = (haystack: Uint8Array, needle: string) => Buffer.from(haystack).includes(Buffer.from(needle, "latin1"));
const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const u32le = (n: number) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];

/** A JPEG segment: marker, then a big-endian length that counts itself. */
const segment = (marker: number, body: string) => [
  0xff,
  marker,
  ((body.length + 2) >> 8) & 255,
  (body.length + 2) & 255,
  ...bytes(body),
];

const JPEG = bytes(
  [0xff, 0xd8],
  segment(0xe0, "JFIF\0keep"),
  segment(0xe1, "Exif\0\0GPS-Auckland"),
  segment(0xe1, "http://ns.adobe.com/xap/1.0/\0<xmp/>"),
  segment(0xe2, "ICC_PROFILE\0colour"),
  segment(0xfe, "a comment"),
  segment(0xdb, "quant-table"),
  [0xff, 0xda, 0, 4, 1, 2, 0xab, 0xcd, 0xff, 0x00, 0xff, 0xd9],
);

const chunk = (kind: string, data: string) => [...u32(data.length), ...bytes(kind, data), 0, 0, 0, 0];
const PNG = bytes(
  [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  chunk("IHDR", "header-13-byt"),
  chunk("tEXt", "Author\0someone"),
  chunk("eXIf", "GPS-Auckland"),
  chunk("IDAT", "pixels"),
  chunk("IEND", ""),
);

const riffChunk = (kind: string, data: number[]) => [
  ...bytes(kind),
  ...u32le(data.length),
  ...data,
  ...(data.length % 2 ? [0] : []),
];
const webp = (...chunks: number[][]) => {
  const body = chunks.flat();
  return bytes("RIFF", u32le(4 + body.length), "WEBP", body);
};
const WEBP = webp(
  riffChunk("VP8X", [0x0c, 0, 0, 0, 1, 0, 0, 1, 0, 0]),
  riffChunk("VP8L", [1, 2, 3]),
  riffChunk("EXIF", [...bytes("GPS-Auckland")]),
  riffChunk("XMP ", [...bytes("<xmp/>")]),
);

describe("report screenshots: type by their bytes, metadata off (ADR 0027)", () => {
  it("tells JPEG, PNG and WebP by their first bytes, not by name", () => {
    expect(sniffImage(JPEG)).toBe("image/jpeg");
    expect(sniffImage(PNG)).toBe("image/png");
    expect(sniffImage(WEBP)).toBe("image/webp");
    expect(sniffImage(bytes("GIF89a......"))).toBeUndefined();
    expect(sniffImage(bytes("<svg xmlns="))).toBeUndefined();
  });

  it("JPEG: drops EXIF, XMP and comments; keeps JFIF, the colour profile and the picture", () => {
    const out = stripMetadata(JPEG, "image/jpeg")!;
    expect(has(out, "GPS-Auckland")).toBe(false);
    expect(has(out, "xap")).toBe(false);
    expect(has(out, "a comment")).toBe(false);
    expect(has(out, "JFIF")).toBe(true);
    expect(has(out, "ICC_PROFILE")).toBe(true);
    expect(has(out, "quant-table")).toBe(true);
    expect([...out.slice(-12)]).toEqual([0xff, 0xda, 0, 4, 1, 2, 0xab, 0xcd, 0xff, 0x00, 0xff, 0xd9]);
  });

  it("PNG: drops text and EXIF chunks up to IEND", () => {
    const out = stripMetadata(PNG, "image/png")!;
    expect(has(out, "someone")).toBe(false);
    expect(has(out, "GPS-Auckland")).toBe(false);
    expect(has(out, "IHDR")).toBe(true);
    expect(has(out, "pixels")).toBe(true);
    expect(has(out, "IEND")).toBe(true);
  });

  it("WebP: drops EXIF and XMP, clears their flags, and writes the size again", () => {
    const out = stripMetadata(WEBP, "image/webp")!;
    expect(has(out, "GPS-Auckland")).toBe(false);
    expect(has(out, "<xmp/>")).toBe(false);
    const view = new DataView(out.buffer);
    expect(view.getUint32(4, true)).toBe(out.length - 8);
    expect(out[20] & 0x0c).toBe(0); // VP8X flags: no EXIF, no XMP
    expect(has(out, "VP8L")).toBe(true);
  });

  it("gives nothing for cut or broken files", () => {
    expect(stripMetadata(JPEG.slice(0, 30), "image/jpeg")).toBeUndefined();
    expect(stripMetadata(PNG.slice(0, PNG.length - 6), "image/png")).toBeUndefined();
    expect(stripMetadata(WEBP.slice(0, WEBP.length - 3), "image/webp")).toBeUndefined();
    expect(stripMetadata(bytes([0xff, 0xd8, 0x00, 0x00]), "image/jpeg")).toBeUndefined();
  });
});
