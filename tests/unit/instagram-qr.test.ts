import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import QRCode from 'qrcode';
import { describe, expect, it } from 'vitest';
import { InstagramQr } from '@/components/public/InstagramQr';
import { instagramUrl } from '@/lib/whatsapp';

describe('InstagramQr (server-rendered inline SVG)', () => {
  const url = instagramUrl('tiffinbox.lhr');
  const html = renderToStaticMarkup(createElement(InstagramQr, { url, label: 'QR code test' }));

  it('is one inline svg with an accessible name, no script and no external reference', () => {
    expect(html.startsWith('<svg')).toBe(true);
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="QR code test"');
    expect(html).not.toMatch(/<script|<image|href=|src=|https?:/);
  });

  it('draws exactly the dark modules of the QR for the profile URL', () => {
    const qr = QRCode.create(url, { errorCorrectionLevel: 'M' });
    const d = /<path d="([^"]+)"/.exec(html)?.[1] ?? '';
    // Each run is "M x y h<run> v1 h-<run> z": the covered area equals the number of dark modules.
    const runs = [...d.matchAll(/h(\d+)v1/g)].map((m) => Number(m[1]));
    const dark = Array.from(qr.modules.data).filter(Boolean).length;
    expect(runs.reduce((a, b) => a + b, 0)).toBe(dark);
    expect(html).toContain(`viewBox="0 0 ${qr.modules.size + 8} ${qr.modules.size + 8}"`);
  });
});
