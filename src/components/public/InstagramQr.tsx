import QRCode from 'qrcode';

const QUIET_ZONE = 4;

/**
 * QR code for the Instagram profile, drawn on the server as one inline SVG path: no client JavaScript and no
 * external request (NFR-11). Dark modules on a white square with the standard 4-module quiet zone, so phone cameras
 * read it on the dark footer.
 */
export function InstagramQr({ url, label }: { url: string; label: string }) {
  const qr = QRCode.create(url, { errorCorrectionLevel: 'M' });
  const size = qr.modules.size;
  const data = qr.modules.data;
  let path = '';
  for (let y = 0; y < size; y += 1) {
    let x = 0;
    while (x < size) {
      if (data[y * size + x]) {
        let run = 1;
        while (x + run < size && data[y * size + x + run]) run += 1;
        path += `M${x + QUIET_ZONE} ${y + QUIET_ZONE}h${run}v1h-${run}z`;
        x += run;
      } else {
        x += 1;
      }
    }
  }
  const total = size + QUIET_ZONE * 2;
  return (
    <svg
      className="t-qr-svg"
      viewBox={`0 0 ${total} ${total}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <rect width={total} height={total} fill="#ffffff" />
      <path d={path} fill="#17201A" />
    </svg>
  );
}
