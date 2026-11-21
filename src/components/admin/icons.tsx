/** Decorative status icons (always aria-hidden; the text next to them carries the meaning). */
interface IconProps {
  className?: string;
}

const PATHS = {
  warn: 'M12 2 1 21h22L12 2zm-1 7h2v6h-2V9zm0 8h2v2h-2v-2z',
  info: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1 5h2v2h-2V7zm0 4h2v6h-2v-6z',
  check:
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1.5 14.5L6 12l1.4-1.4 3.1 3.1 6.1-6.1L18 9l-7.5 7.5z',
  x: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4.2 12.8-1.4 1.4-2.8-2.8-2.8 2.8-1.4-1.4 2.8-2.8-2.8-2.8 1.4-1.4 2.8 2.8 2.8-2.8 1.4 1.4-2.8 2.8 2.8 2.8z',
} as const;

export function StatusIcon({ name, className = 'ico' }: IconProps & { name: keyof typeof PATHS }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </svg>
  );
}
