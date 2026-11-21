import type { ContentInfo } from '@/content';

/**
 * Yellow "Preview" bar shown only while an admin views unpublished drafts (FR-22, architecture sec. 8.2).
 * Also asks search engines not to index the page. "Exit preview" turns draft mode off.
 */
export function PreviewBanner({ info }: { info: ContentInfo }) {
  if (info.source !== 'preview') return null;
  return (
    <>
      <meta name="robots" content="noindex, nofollow" />
      <div className="preview-banner" role="note" data-testid="preview-banner">
        <strong>Preview.</strong> You are looking at unpublished drafts. Visitors cannot see this.{' '}
        <a href="/admin/preview?disable=1&amp;to=/admin/publish">Exit preview</a>
      </div>
    </>
  );
}
