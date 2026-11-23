import type { PublicImage } from '@/content';
import { publicMediaUrl } from '@/lib/media-url';

/**
 * A photo on a public page (FR-21), rendered only when one is assigned in the admin. No placeholder box: pages
 * look complete without a photo.
 */
export function PagePhoto({
  image,
  shape = 'photo',
  className,
  priority = false,
}: {
  image: PublicImage | null;
  shape?: 'photo' | 'wide';
  className?: string;
  priority?: boolean;
}) {
  const url = image ? publicMediaUrl(image.path) : null;
  if (!image || !url) return null;
  return (
    <div className={`page-photo ${shape}${className ? ` ${className}` : ''}`}>
      {/* Plain <img>: the file is already resized and re-encoded by the upload pipeline. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={image.alt}
        width={image.width ?? undefined}
        height={image.height ?? undefined}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        decoding="async"
      />
    </div>
  );
}
