import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { MASTER_SIDE, MediaRejected, processUpload } from '@/admin/server/media-processing';

async function jpeg(width: number, height: number, withExif = false): Promise<Buffer> {
  let image = sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 120, b: 40 } },
  }).jpeg();
  if (withExif)
    image = image.withExif({ IFD0: { Copyright: 'secret-photographer', Artist: 'someone' } });
  return image.toBuffer();
}
const claimed = (name: string, type: string, buf: Buffer) => ({ name, type, size: buf.length });

describe('processUpload (server-side media validation, FR-21)', () => {
  it('accepts a JPEG and returns a sanitised master with hash name data', async () => {
    const input = await jpeg(800, 600);
    const out = await processUpload(input, claimed('lunch.jpg', 'image/jpeg', input));
    expect(out.contentType).toBe('image/jpeg');
    expect(out.extension).toBe('jpg');
    expect(out.width).toBe(800);
    expect(out.height).toBe(600);
    expect(out.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(out.bytes).toBe(out.buffer.length);
  });

  it('accepts PNG and WebP', async () => {
    const png = await sharp({ create: { width: 50, height: 40, channels: 3, background: '#fff' } })
      .png()
      .toBuffer();
    expect((await processUpload(png, claimed('a.png', 'image/png', png))).extension).toBe('png');
    const webp = await sharp({ create: { width: 50, height: 40, channels: 3, background: '#fff' } })
      .webp()
      .toBuffer();
    expect((await processUpload(webp, claimed('a.webp', 'image/webp', webp))).extension).toBe(
      'webp',
    );
  });

  it('strips EXIF and GPS metadata', async () => {
    const input = await jpeg(300, 200, true);
    expect((await sharp(input).metadata()).exif).toBeDefined(); // the test input really carries EXIF
    const out = await processUpload(input, claimed('p.jpg', 'image/jpeg', input));
    const meta = await sharp(out.buffer).metadata();
    expect(meta.exif).toBeUndefined();
    expect(out.buffer.includes(Buffer.from('secret-photographer'))).toBe(false);
  });

  it('shrinks the longest side to the master size and never enlarges', async () => {
    const big = await jpeg(4000, 1000);
    const out = await processUpload(big, claimed('wide.jpg', 'image/jpeg', big));
    expect(out.width).toBe(MASTER_SIDE);
    expect(out.height).toBe(500);
    const small = await jpeg(100, 80);
    expect((await processUpload(small, claimed('s.jpg', 'image/jpeg', small))).width).toBe(100);
  });

  it('refuses a file whose bytes are not a JPG/PNG/WebP, whatever it claims to be', async () => {
    const gif = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#000' } })
      .gif()
      .toBuffer();
    await expect(processUpload(gif, claimed('cat.jpg', 'image/jpeg', gif))).rejects.toThrow(
      MediaRejected,
    );
    const script = Buffer.from('<?php echo 1; ?>');
    await expect(processUpload(script, claimed('x.jpg', 'image/jpeg', script))).rejects.toThrow(
      /could not be read/,
    );
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    );
    await expect(processUpload(svg, claimed('x.png', 'image/png', svg))).rejects.toThrow(
      MediaRejected,
    );
  });

  it('refuses a claimed type outside JPG/PNG/WebP, an empty file, and a file over 8 MB', async () => {
    const input = await jpeg(10, 10);
    await expect(processUpload(input, claimed('a.heic', 'image/heic', input))).rejects.toThrow(
      /not supported/,
    );
    await expect(
      processUpload(Buffer.alloc(0), { name: 'a.jpg', type: 'image/jpeg', size: 0 }),
    ).rejects.toThrow(/empty/);
    await expect(
      processUpload(Buffer.alloc(9 * 1024 * 1024), {
        name: 'big.jpg',
        type: 'image/jpeg',
        size: 9 * 1024 * 1024,
      }),
    ).rejects.toThrow(/larger than 8 MB/);
  });

  it('refuses images over 6000 px on the longest side', async () => {
    const huge = await jpeg(6100, 10);
    await expect(processUpload(huge, claimed('huge.jpg', 'image/jpeg', huge))).rejects.toThrow(
      /6000 px/,
    );
  });

  it('gives identical masters the same checksum (one stored object per photo)', async () => {
    const input = await jpeg(64, 64);
    const a = await processUpload(input, claimed('a.jpg', 'image/jpeg', input));
    const b = await processUpload(input, claimed('b.jpg', 'image/jpeg', input));
    expect(a.checksum).toBe(b.checksum);
  });
});
