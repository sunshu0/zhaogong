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
  if (type === "image/jpeg") {
    const out = stripJpeg(bytes);
    return out === CUT ? undefined : out;
  }
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

const isRestart = (marker: number) => marker >= 0xd0 && marker <= 0xd7;
/** stripJpeg's answer for a JPEG whose bytes run out before its end-of-image marker. */
const CUT = Symbol("cut");

/**
 * Whether a JPEG ends before its end-of-image marker (a screenshot saved or sent only in part), as opposed to one
 * broken some other way: the report form says the image is incomplete rather than of the wrong type.
 */
export function isCutJpeg(bytes: Uint8Array): boolean {
  return sniffImage(bytes) === "image/jpeg" && stripJpeg(bytes) === CUT;
}

/**
 * JPEG: keeps the segments that make the picture (and APP0 JFIF, the APP2 colour profile, APP14 Adobe colour
 * transform); drops the other APPn (APP1 is EXIF and XMP; APP2 MPF points at a second picture) and COM, also
 * between the scans of a progressive JPEG. Each scan's coded data is copied as it is; the file ends at the first
 * end-of-image marker, so whatever follows it (some phones put a second picture there, with its own EXIF) is dropped.
 */
function stripJpeg(bytes: Uint8Array): Uint8Array | typeof CUT | undefined {
  const parts: Uint8Array[] = [bytes.subarray(0, 2)];
  let scanned = false;
  let i = 2;
  while (i + 1 < bytes.length) {
    if (bytes[i] !== 0xff) return undefined;
    const marker = bytes[i + 1];
    if (marker === 0xff) {
      i += 1; // fill byte
      continue;
    }
    if (marker === 0xd9) {
      if (!scanned) return undefined; // the picture ended before its scan
      parts.push(bytes.subarray(i, i + 2));
      return join(parts);
    }
    if (marker === 0x01 || isRestart(marker)) {
      parts.push(bytes.subarray(i, i + 2));
      i += 2;
      continue;
    }
    if (i + 3 >= bytes.length) return CUT;
    const end = i + 2 + ((bytes[i + 2] << 8) | bytes[i + 3]);
    if (end > bytes.length) return CUT;
    const keep =
      !(marker >= 0xe1 && marker <= 0xef && marker !== 0xe2 && marker !== 0xee) &&
      marker !== 0xfe &&
      !(marker === 0xe2 && ascii(bytes, i + 4, 12) !== "ICC_PROFILE\0") &&
      !(marker === 0xee && ascii(bytes, i + 4, 5) !== "Adobe");
    if (keep) parts.push(bytes.subarray(i, end));
    i = end;
    if (marker === 0xda) {
      // The coded data runs to the next marker; inside it 0xff is followed only by a stuffed 0x00 or a restart.
      scanned = true;
      let next = i;
      while (next + 1 < bytes.length && !(bytes[next] === 0xff && bytes[next + 1] !== 0 && !isRestart(bytes[next + 1])))
        next += 1;
      if (next + 1 >= bytes.length) return CUT; // no end-of-image marker
      parts.push(bytes.subarray(i, next));
      i = next;
    }
  }
  return CUT;
}

/**
 * The PNG chunks that make the picture or change how it looks: header, palette, transparency, pixels, end, and the
 * colour chunks. Everything else (text, EXIF, time, private and unknown chunks, animation) is dropped; an animated
 * PNG shows its first picture, as browsers without APNG do.
 */
const PNG_KEEP = new Set(["IHDR", "PLTE", "tRNS", "IDAT", "IEND", "gAMA", "cHRM", "sRGB", "iCCP", "cICP"]);

/** PNG: keeps the chunks in PNG_KEEP up to IEND; whatever follows IEND is dropped. */
function stripPng(bytes: Uint8Array): Uint8Array | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const parts: Uint8Array[] = [bytes.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= bytes.length) {
    const end = i + 12 + view.getUint32(i);
    if (end > bytes.length) return undefined;
    const kind = ascii(bytes, i + 4, 4);
    if (PNG_KEEP.has(kind)) parts.push(bytes.subarray(i, end));
    i = end;
    if (kind === "IEND") return join(parts);
  }
  return undefined;
}

/** The WebP chunks that make the picture: bitstreams, alpha, the extended header, colour profile and animation. */
const WEBP_KEEP = new Set(["VP8 ", "VP8L", "VP8X", "ALPH", "ICCP", "ANIM", "ANMF"]);
/** Inside an animation frame, after its 16-byte header: the frame's alpha and bitstream. */
const WEBP_FRAME_KEEP = new Set(["ALPH", "VP8 ", "VP8L"]);
const ANMF_HEADER = 16;

function riffChunk(kind: string, parts: Uint8Array[]): Uint8Array {
  const body = join(parts);
  const out = new Uint8Array(8 + body.length);
  out.set([...kind].map((c) => c.charCodeAt(0)));
  new DataView(out.buffer).setUint32(4, body.length, true);
  out.set(body, 8);
  return out;
}

/** The chunks from `from` to `to` that are in `keep`, or undefined when they do not fill that span exactly. */
function webpChunks(bytes: Uint8Array, from: number, to: number, keep: Set<string>): Uint8Array[] | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const parts: Uint8Array[] = [];
  let i = from;
  while (i + 8 <= to) {
    const size = view.getUint32(i + 4, true);
    const end = i + 8 + size + (size % 2);
    if (end > to) return undefined;
    const kind = ascii(bytes, i, 4);
    if (!keep.has(kind)) {
      i = end;
      continue;
    }
    if (kind === "VP8X" && size >= 1) {
      const chunk = bytes.slice(i, end);
      chunk[8] &= ~(0x08 | 0x04); // EXIF and XMP present
      parts.push(chunk);
    } else if (kind === "ANMF") {
      if (size < ANMF_HEADER) return undefined;
      const frame = webpChunks(bytes, i + 8 + ANMF_HEADER, i + 8 + size, WEBP_FRAME_KEEP);
      if (!frame) return undefined;
      parts.push(riffChunk("ANMF", [bytes.subarray(i + 8, i + 8 + ANMF_HEADER), ...frame]));
    } else parts.push(bytes.subarray(i, end));
    i = end;
  }
  return i === to ? parts : undefined;
}

/**
 * WebP: keeps the chunks in WEBP_KEEP (and in each animation frame only its picture), clears the EXIF and XMP flags
 * in VP8X, and writes the RIFF size again; whatever follows the RIFF is dropped.
 */
function stripWebp(bytes: Uint8Array): Uint8Array | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const riffEnd = 8 + view.getUint32(4, true);
  if (riffEnd > bytes.length) return undefined;
  const parts = webpChunks(bytes, 12, riffEnd, WEBP_KEEP);
  if (!parts?.length) return undefined;
  const body = join(parts);
  const out = new Uint8Array(12 + body.length);
  out.set(bytes.subarray(0, 12));
  new DataView(out.buffer).setUint32(4, 4 + body.length, true);
  out.set(body, 12);
  return out;
}
