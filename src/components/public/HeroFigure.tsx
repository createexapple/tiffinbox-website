/**
 * The home hero figure (design "Tiffin Box Lahore"): a steel tiffin carrier beside a puffed roti over a flame, drawn
 * in SVG, with the steam rising only when the visitor has not asked for reduced motion. It is always the design's
 * drawing: a photo assigned to the home_hero place in the admin no longer changes the public site.
 */
export function HeroFigure() {
  return (
    <div className="t-fig" aria-hidden="true">
      <svg focusable="false" viewBox="0 0 520 420" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="tb-steel" x1="0" x2="1">
            <stop offset="0" stopColor="#8E979B" />
            <stop offset=".35" stopColor="#E9EEF0" />
            <stop offset=".6" stopColor="#C3CACD" />
            <stop offset="1" stopColor="#7C8589" />
          </linearGradient>
          <linearGradient id="tb-rim" x1="0" x2="1">
            <stop offset="0" stopColor="#A7B0B3" />
            <stop offset=".4" stopColor="#F6F8F9" />
            <stop offset="1" stopColor="#959DA1" />
          </linearGradient>
          <linearGradient id="tb-roti" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#F3D9A4" />
            <stop offset="1" stopColor="#D9A862" />
          </linearGradient>
          <radialGradient id="tb-glow" cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#FFE7B0" stopOpacity=".9" />
            <stop offset="1" stopColor="#FFE7B0" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="250" cy="170" r="190" fill="url(#tb-glow)" />
        <path d="M0 330 Q260 300 520 330 V420 H0Z" fill="#B98A57" />
        <path d="M0 340 Q260 312 520 340" stroke="#D7AE7B" strokeWidth="3" fill="none" />
        <path d="M70 352 L340 340 L372 392 L48 404Z" fill="#1F5134" />
        <path d="M70 352 L340 340 L344 347 L66 359Z" fill="#2E6B47" />
        <g stroke="#F2B441" strokeWidth="2" opacity=".5">
          <path d="M80 372 L350 362" />
          <path d="M60 390 L362 378" />
        </g>
        <ellipse cx="205" cy="352" rx="98" ry="12" fill="#00000033" />
        <g>
          <rect x="118" y="270" width="176" height="74" rx="14" fill="url(#tb-steel)" />
          <rect x="112" y="262" width="188" height="14" rx="7" fill="url(#tb-rim)" />
          <rect x="118" y="190" width="176" height="74" rx="14" fill="url(#tb-steel)" />
          <rect x="112" y="182" width="188" height="14" rx="7" fill="url(#tb-rim)" />
          <rect x="118" y="112" width="176" height="74" rx="14" fill="url(#tb-steel)" />
          <rect x="112" y="104" width="188" height="14" rx="7" fill="url(#tb-rim)" />
          <path d="M126 96 Q206 62 286 96 L282 108 L130 108Z" fill="url(#tb-rim)" />
          <path
            d="M104 120 V320 M308 120 V320"
            stroke="#6E777B"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <path
            d="M104 120 Q104 30 206 30 Q308 30 308 120"
            fill="none"
            stroke="#6E777B"
            strokeWidth="7"
          />
          <rect x="194" y="22" width="24" height="18" rx="6" fill="#4E575B" />
          <rect x="132" y="126" width="10" height="50" rx="5" fill="#FFFFFF66" />
          <rect x="132" y="204" width="10" height="50" rx="5" fill="#FFFFFF66" />
          <rect x="132" y="284" width="10" height="50" rx="5" fill="#FFFFFF66" />
        </g>
        <g fill="none" stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" opacity=".85">
          <path className="t-steam" d="M176 84c-12-16 12-24 0-44" />
          <path className="t-steam" d="M206 78c-12-16 12-24 0-44" />
          <path className="t-steam" d="M236 84c-12-16 12-24 0-44" />
        </g>
        <g transform="translate(330 210)">
          <rect x="10" y="98" width="150" height="10" rx="5" fill="#3B3F42" />
          <path
            d="M50 108 l10 -22 l10 22Z M80 108 l10 -28 l10 28Z M110 108 l10 -22 l10 22Z"
            fill="#E8833A"
          />
          <path
            d="M58 108 l4 -10 l4 10Z M88 108 l4 -14 l4 14Z M118 108 l4 -10 l4 10Z"
            fill="#FFD36B"
          />
          <path
            d="M14 88 Q14 22 86 18 Q156 22 156 88 Q156 98 86 100 Q14 98 14 88Z"
            fill="url(#tb-roti)"
            stroke="#9A6A34"
            strokeWidth="3"
          />
          <path
            d="M36 50 Q64 32 100 34"
            stroke="#FFF2CF"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
          <g fill="#8C4F22">
            <ellipse cx="52" cy="70" rx="7" ry="5" />
            <ellipse cx="96" cy="58" rx="5" ry="4" />
            <ellipse cx="118" cy="78" rx="8" ry="5" />
            <ellipse cx="78" cy="84" rx="4" ry="3" />
            <ellipse cx="132" cy="54" rx="3" ry="2.5" />
          </g>
        </g>
      </svg>
    </div>
  );
}
