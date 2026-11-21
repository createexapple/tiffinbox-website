/**
 * Server-side image pipeline (FR-21, NFR-07; architecture sec. 8.5). The browser's claim about a file (name,
 * type, size) is never trusted: the bytes are decoded by `sharp`, so a renamed script or GIF is rejected, then
 * re-encoded to a sanitised master. Re-encoding strips EXIF, GPS and any other embedded metadata. The longest
 * side is limited to 2000 px (the master), the input to 6000 px, and the stored file to the bucket's 2 MiB limit.
 * No database or framework imports, so it is unit-tested with generated images (tests/unit/admin-media.test.ts).
 */
import 'server-only';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { MEDIA_MAX_BYTES, MEDIA_TYPES } from '../validation/content';

export const MAX_INPUT_SIDE = 6000;
export const MASTER_SIDE = 2000;
/** The public `media` bucket accepts files up to 2 MiB (supabase/migrations/..._storage.sql). */
export const MAX_MASTER_BYTES = 2 * 1024 * 1024;

export type MediaContentType = (typeof MEDIA_TYPES)[number];

export interface ProcessedImage {
  buffer: Buffer;
  contentType: MediaContentType;
  extension: 'jpg' | 'png' | 'webp';
  width: number;
  height: number;
  bytes: number;
  /** SHA-256 of the sanitised master; also the stored file name, so identical photos map to one object. */
  checksum: string;
}

/** The file was refused; `message` is safe to show to the admin. */
export class MediaRejected extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MediaRejected';
  }
}

const FORMAT_TO_TYPE: Record<string, MediaContentType> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};
const TYPE_TO_EXTENSION: Record<MediaContentType, ProcessedImage['extension']> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

async function encode(
  input: Buffer,
  type: MediaContentType,
  quality: number,
): Promise<{ data: Buffer; width: number; height: number }> {
  let pipeline = sharp(input, {
    limitInputPixels: MAX_INPUT_SIDE * MAX_INPUT_SIDE,
    failOn: 'error',
  })
    .rotate() // apply EXIF orientation first, then metadata is dropped by the encoder
    .resize({ width: MASTER_SIDE, height: MASTER_SIDE, fit: 'inside', withoutEnlargement: true });
  pipeline =
    type === 'image/jpeg'
      ? pipeline.jpeg({ quality, mozjpeg: true })
      : type === 'image/png'
        ? pipeline.png({ compressionLevel: 9 })
        : pipeline.webp({ quality });
  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/**
 * Validates and sanitises an uploaded photo. Throws `MediaRejected` with an admin-safe message when the file is
 * too large, is not a JPG/PNG/WebP image, cannot be decoded, or is too big in pixels.
 */
export async function processUpload(
  input: Buffer,
  claimed: { name: string; type: string; size: number },
): Promise<ProcessedImage> {
  if (input.length === 0) throw new MediaRejected(`${claimed.name} is empty. (Nothing was saved.)`);
  if (input.length > MEDIA_MAX_BYTES || claimed.size > MEDIA_MAX_BYTES) {
    throw new MediaRejected(`${claimed.name} is larger than 8 MB. (Nothing was saved.)`);
  }
  if (!(MEDIA_TYPES as readonly string[]).includes(claimed.type)) {
    throw new MediaRejected(
      `${claimed.name} is not supported. Use JPG, PNG or WebP. (Nothing was saved.)`,
    );
  }

  let format: string | undefined;
  let width = 0;
  let height = 0;
  try {
    const meta = await sharp(input, { limitInputPixels: false, failOn: 'error' }).metadata();
    format = meta.format;
    width = meta.width ?? 0;
    height = meta.height ?? 0;
  } catch {
    throw new MediaRejected(`${claimed.name} could not be read as an image. (Nothing was saved.)`);
  }
  // The decoded format decides, not the claimed type: a GIF or SVG renamed to .jpg is refused here.
  const type = format ? FORMAT_TO_TYPE[format] : undefined;
  if (!type) {
    throw new MediaRejected(
      `${claimed.name} is not a JPG, PNG or WebP image. (Nothing was saved.)`,
    );
  }
  if (width < 1 || height < 1 || Math.max(width, height) > MAX_INPUT_SIDE) {
    throw new MediaRejected(
      `${claimed.name} is too large (${width} x ${height} px). The longest side can be at most ${MAX_INPUT_SIDE} px. (Nothing was saved.)`,
    );
  }

  let outType: MediaContentType = type;
  let out: { data: Buffer; width: number; height: number };
  try {
    out = await encode(input, outType, 85);
    if (out.data.length > MAX_MASTER_BYTES) {
      // Large PNG masters: WebP is far smaller at the same visual quality.
      outType = 'image/webp';
      out = await encode(input, outType, 80);
    }
  } catch {
    throw new MediaRejected(`${claimed.name} could not be processed. (Nothing was saved.)`);
  }
  if (out.data.length > MAX_MASTER_BYTES) {
    throw new MediaRejected(
      `${claimed.name} is too detailed to store. Please use a smaller photo. (Nothing was saved.)`,
    );
  }

  return {
    buffer: out.data,
    contentType: outType,
    extension: TYPE_TO_EXTENSION[outType],
    width: out.width,
    height: out.height,
    bytes: out.data.length,
    checksum: createHash('sha256').update(out.data).digest('hex'),
  };
}
