import type { PublicImage } from '@/content';
import { publicMediaUrl } from '@/lib/media-url';
import { PhotoPlaceholder } from './PhotoPlaceholder';

/**
 * A photo slot on a public page (FR-21): the published photo when one is assigned, otherwise the labelled
 * placeholder. The frame keeps the same aspect ratio either way, so there is no layout shift.
 */
export function PagePhoto({
  image,
  description,
  shape = 'photo',
  className,
  priority = false,
}: {
  image: PublicImage | null;
  description: string;
  shape?: 'photo' | 'wide';
  className?: string;
  priority?: boolean;
}) {
  const url = image ? publicMediaUrl(image.path) : null;
  if (!image || !url) {
    return <PhotoPlaceholder description={description} shape={shape} className={className} />;
  }
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
