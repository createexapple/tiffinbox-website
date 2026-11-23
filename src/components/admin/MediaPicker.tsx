'use client';

import { useState } from 'react';
import { useQuery } from './AdminProvider';
import { Dialog, QueryBoundary } from './ui';

/** Photo tile; a labelled placeholder when there is no stored photo (the client's own photos only, AS-04). */
export function MediaTile({
  fileName,
  label,
  url,
}: {
  fileName: string;
  label?: string;
  /** Public URL of the stored photo; absent for the test mock, which shows the placeholder. */
  url?: string;
}) {
  if (url) {
    // Admin thumbnail of a stored master (already resized to 2000 px): no image optimiser needed.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={label ?? fileName}
        loading="lazy"
        style={{ width: '100%', borderRadius: 'var(--r-md)' }}
      />
    );
  }
  return (
    <div className="ph" role="img" aria-label={label ?? `Placeholder for ${fileName}`}>
      <span>
        client photo
        <br />({fileName})
      </span>
    </div>
  );
}

/** A-09 image picker state: opened from the dish form (and previewable on the Images screen). */
export function MediaPicker({
  open,
  selectedId,
  onSelect,
  onClose,
}: {
  open: boolean;
  selectedId: string | null;
  onSelect: (mediaId: string | null) => void;
  onClose: () => void;
}) {
  const { state, reload } = useQuery((repo) => repo.listMedia());
  const [choice, setChoice] = useState<string | null>(selectedId);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Choose an image"
      actions={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              onSelect(choice);
              onClose();
            }}
          >
            Use this image
          </button>
        </>
      }
    >
      <QueryBoundary query={state} reload={reload}>
        {(media) =>
          media.length === 0 ? (
            <p>
              No images yet. Upload one on the Images screen first (alt text is required there).
            </p>
          ) : (
            <>
              <div className="media-grid">
                {media.map((m) => (
                  <figure key={m.id}>
                    <button
                      type="button"
                      className="pick"
                      aria-pressed={choice === m.id}
                      onClick={() => setChoice(m.id)}
                    >
                      <MediaTile fileName={m.fileName} label={m.altText} />
                      <figcaption>
                        <b>{m.usedOn.length > 0 ? 'Used' : 'Not used'}</b>
                        <br />
                        <span className="small">Alt: {m.altText}</span>
                      </figcaption>
                    </button>
                  </figure>
                ))}
              </div>
              <p>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setChoice(null)}
                >
                  No photo
                </button>
              </p>
            </>
          )
        }
      </QueryBoundary>
    </Dialog>
  );
}
