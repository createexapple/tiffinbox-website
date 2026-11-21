import type { ContentInfo } from '@/content';

/** Honest label while content is sample data (Stage 2). Not rendered once the live source is connected. */
export function MockBanner({ info }: { info: ContentInfo }) {
  if (info.source !== 'mock') return null;
  return (
    <div className="mock-banner" role="note">
      <strong>Preview with sample content.</strong> {info.note}
    </div>
  );
}
