// 举报截图 (ADR 0027 §2): what kind of image a file is, judged by its bytes (not its name or the browser's type), and
// the same image without the data a phone or app writes beside the picture: EXIF (with where it was taken), XMP,
// comments, text chunks. The picture itself is copied as it is; nothing is decoded, so this runs anywhere (Node,
// Workers) without a dependency. Unknown or broken files give undefined.

export type ImageType = "image/jpeg" | "image/png" | "image/webp";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const ascii = (bytes: Uint8Array, at: number, length: number) =>
  String.fromCharCode(...bytes.subarray(at, at + length));

/** The image's type from its first bytes. */
export function sniffImage(bytes: Uint8Array): ImageType | undefined {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && PNG_SIGNATURE.every((b, i) => bytes[i] === b)) return "image/png";
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return "image/webp";
  return undefined;
}

/** The image without its metadata, or undefined when the file is not a whole image of that type. */
export function stripMetadata(bytes: Uint8Array, type: ImageType): Uint8Array | undefined {
  if (type === "image/jpeg") return stripJpeg(bytes);
  if (type === "image/png") return stripPng(bytes);
  return stripWebp(bytes);
}

function join(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/**
 * JPEG: keeps the segments that make the picture (and APP0 JFIF, the APP2 colour profile, APP14 Adobe colour
 * transform); drops the other APPn (APP1 is EXIF and XMP) and COM. From the start of the scan the rest is copied.
 */
function stripJpeg(bytes: Uint8Array): Uint8Array | undefined {
  const parts: Uint8Array[] = [bytes.subarray(0, 2)];
  let i = 2;
  while (i + 1 < bytes.length) {
    if (bytes[i] !== 0xff) return undefined;
    const marker = bytes[i + 1];
    if (marker === 0xff) {
      i += 1; // fill byte
      continue;
    }
    if (marker === 0xda) {
      parts.push(bytes.subarray(i));
      return join(parts);
    }
    if (marker === 0xd9) return undefined; // the picture ended before its scan
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      parts.push(bytes.subarray(i, i + 2));
      i += 2;
      continue;
    }
    if (i + 3 >= bytes.length) return undefined;
    const end = i + 2 + ((bytes[i + 2] << 8) | bytes[i + 3]);
    if (end > bytes.length) return undefined;
    const keep =
      !(marker >= 0xe1 && marker <= 0xef && marker !== 0xe2 && marker !== 0xee) &&
      marker !== 0xfe &&
      !(marker === 0xe2 && ascii(bytes, i + 4, 12) !== "ICC_PROFILE\0") &&
      !(marker === 0xee && ascii(bytes, i + 4, 5) !== "Adobe");
    if (keep) parts.push(bytes.subarray(i, end));
    i = end;
  }
  return undefined;
}

const PNG_DROP = new Set(["tEXt", "zTXt", "iTXt", "eXIf", "tIME"]);

/** PNG: drops the text, EXIF and time chunks; the rest up to IEND is copied. */
function stripPng(bytes: Uint8Array): Uint8Array | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const parts: Uint8Array[] = [bytes.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= bytes.length) {
    const end = i + 12 + view.getUint32(i);
    if (end > bytes.length) return undefined;
    const kind = ascii(bytes, i + 4, 4);
    if (!PNG_DROP.has(kind)) parts.push(bytes.subarray(i, end));
    i = end;
    if (kind === "IEND") return join(parts);
  }
  return undefined;
}

/** WebP: drops the EXIF and XMP chunks and clears their flags in VP8X; the RIFF size is written again. */
function stripWebp(bytes: Uint8Array): Uint8Array | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const riffEnd = 8 + view.getUint32(4, true);
  if (riffEnd > bytes.length) return undefined;
  const parts: Uint8Array[] = [];
  let i = 12;
  while (i + 8 <= riffEnd) {
    const size = view.getUint32(i + 4, true);
    const end = i + 8 + size + (size % 2);
    if (end > riffEnd) return undefined;
    const kind = ascii(bytes, i, 4);
    if (kind === "VP8X" && size >= 1) {
      const chunk = bytes.slice(i, end);
      chunk[8] &= ~(0x08 | 0x04); // EXIF and XMP present
      parts.push(chunk);
    } else if (kind !== "EXIF" && kind !== "XMP ") parts.push(bytes.subarray(i, end));
    i = end;
  }
  if (i !== riffEnd || !parts.length) return undefined;
  const body = join(parts);
  const out = new Uint8Array(12 + body.length);
  out.set(bytes.subarray(0, 12));
  new DataView(out.buffer).setUint32(4, 4 + body.length, true);
  out.set(body, 12);
  return out;
}
