'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { MediaRow } from '@/admin/repository';
import { MEDIA_MAX_BYTES, validateAltText, validateMediaFile } from '@/admin/validation/content';
import { useAdmin, useQuery } from '../AdminProvider';
import { MediaPicker, MediaTile } from '../MediaPicker';
import { TextField } from '../fields';
import { useToast } from '../Toast';
import { Alert, Dialog, EmptyState, PageHead, QueryBoundary } from '../ui';

interface Pending {
  fileName: string;
  type: string;
  size: number;
  altText: string;
}

/**
 * A-09 (FR-21). STAGE 2 MOCK: the chosen file is checked (type, size, alt text) but never read or stored;
 * the library shows a labelled placeholder tile. Real upload, re-encode and metadata stripping are Stage 3
 * (architecture sec. 8.5). No stock or generated food images are used (AS-04).
 */
export function MediaScreen() {
  const { repo } = useAdmin();
  const toast = useToast();
  const list = useQuery((r) => r.listMedia());
  const fileRef = useRef<HTMLInputElement>(null);
  const [alt, setAlt] = useState('');
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [altError, setAltError] = useState<string | undefined>();
  const [pending, setPending] = useState<Pending | null>(null);
  const [progress, setProgress] = useState(0);
  const [deleting, setDeleting] = useState<MediaRow | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Simulated upload progress; completes the (mock) upload when it reaches 100.
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => setProgress((p) => Math.min(100, p + 20)), 250);
    return () => clearInterval(timer);
  }, [pending]);

  useEffect(() => {
    if (!pending || progress < 100) return;
    const file = pending;
    repo
      .uploadMedia({ fileName: file.fileName, type: file.type, size: file.size }, file.altText)
      .then(
        () => {
          setPending(null);
          setProgress(0);
          setAlt('');
          if (fileRef.current) fileRef.current.value = '';
          toast({ text: `Uploaded ${file.fileName}. Available to choose in dishes and pages.` });
        },
        (e: unknown) => {
          setPending(null);
          setProgress(0);
          setError(e instanceof Error ? e.message : 'The upload failed. Nothing was saved.');
        },
      );
  }, [pending, progress, repo, toast]);

  function onUpload(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const file = fileRef.current?.files?.[0] ?? null;
    const problems = validateMediaFile(
      file ? { name: file.name, type: file.type, size: file.size } : null,
    );
    const altProblem = validateAltText(alt) ?? undefined;
    setFileErrors(problems);
    setAltError(altProblem);
    if (problems.length > 0 || altProblem || !file) return;
    setProgress(0);
    setPending({ fileName: file.name, type: file.type, size: file.size, altText: alt.trim() });
  }

  async function confirmDelete(row: MediaRow) {
    setDeleting(null);
    try {
      await repo.deleteMedia(row.id);
      toast({ text: `Deleted ${row.fileName}.` });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please try again.');
    }
  }

  return (
    <>
      <PageHead
        title="Images"
        sub="Real photos of your own food only. This Stage 2 screen shows placeholders and does not store files."
        actions={
          <button type="button" className="btn btn-secondary" onClick={() => setPickerOpen(true)}>
            Preview the image picker
          </button>
        }
      />
      {error ? (
        <Alert tone="err" title="That did not work.">
          {error}
        </Alert>
      ) : null}

      <section className="panel" aria-labelledby="upload-h">
        <h2 id="upload-h">Upload an image</h2>
        <form noValidate onSubmit={onUpload}>
          {fileErrors.map((message) => (
            <div key={message} style={{ marginBottom: 'var(--sp-3)' }}>
              <Alert tone="err" title="This file could not be uploaded.">
                {message}
              </Alert>
            </div>
          ))}
          <div className="field">
            <label htmlFor="media-file">Choose a photo</label>
            <input
              id="media-file"
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={pending !== null}
              aria-describedby="media-file-h"
              style={{ minHeight: 'var(--tap-lg)', width: '100%' }}
            />
            <span className="hint" id="media-file-h">
              JPG, PNG or WebP, up to {MEDIA_MAX_BYTES / (1024 * 1024)} MB. Location data is removed
              automatically (Stage 3).
            </span>
          </div>
          <TextField
            id="media-alt"
            label="Alt text (describe the photo for people who cannot see it)"
            required
            value={alt}
            onChange={setAlt}
            error={altError}
            disabled={pending !== null}
          />
          {pending ? (
            <div role="status">
              <p id="pg" className="small" style={{ marginBottom: 'var(--sp-1)' }}>
                Uploading {pending.fileName}: {progress}%
              </p>
              <div
                className="progress"
                role="progressbar"
                aria-labelledby="pg"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <span style={{ width: `${progress}%` }} />
              </div>
              <p>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: 'var(--sp-3)' }}
                  onClick={() => {
                    setPending(null);
                    setProgress(0);
                  }}
                >
                  Cancel upload
                </button>
              </p>
            </div>
          ) : (
            <button type="submit" className="btn btn-primary">
              Upload
            </button>
          )}
        </form>
      </section>

      <h2 style={{ fontSize: 'var(--fs-lg)' }}>Your images</h2>
      <QueryBoundary query={list.state} reload={list.reload}>
        {(media) =>
          media.length === 0 ? (
            <EmptyState title="No images yet">
              Upload your first photo above. Every image needs alt text.
            </EmptyState>
          ) : (
            <div className="media-grid">
              {media.map((m) => (
                <figure key={m.id}>
                  <MediaTile fileName={m.fileName} label={m.altText} />
                  <figcaption>
                    <b>{m.usedOn.length > 0 ? 'Used' : 'Not used'}</b>
                    <br />
                    <span className="muted">
                      {m.usedOn.length > 0 ? m.usedOn.join(', ') : 'Not used yet'}
                    </span>
                    <br />
                    <span className="small">Alt: {m.altText}</span>
                    <br />
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setDeleting(m)}
                    >
                      Delete<span className="sr-only"> {m.fileName}</span>
                    </button>
                  </figcaption>
                </figure>
              ))}
            </div>
          )
        }
      </QueryBoundary>

      <Dialog
        open={deleting !== null}
        destructive
        onClose={() => setDeleting(null)}
        title={
          deleting && deleting.usedOn.length > 0 ? 'This image is in use' : 'Delete this image?'
        }
        actions={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setDeleting(null)}>
              Keep it
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => deleting && confirmDelete(deleting)}
            >
              {deleting && deleting.usedOn.length > 0 ? 'Delete anyway' : 'Delete'}
            </button>
          </>
        }
      >
        {deleting && deleting.usedOn.length > 0 ? (
          <>
            <p>“{deleting.fileName}” is used on:</p>
            <ul>
              {deleting.usedOn.map((place) => (
                <li key={place}>{place}</li>
              ))}
            </ul>
            <p>If you delete it, those places will have no photo.</p>
          </>
        ) : (
          <p>“{deleting?.fileName}” will be removed from your images.</p>
        )}
      </Dialog>

      <MediaPicker
        key={String(pickerOpen)}
        open={pickerOpen}
        selectedId={null}
        onSelect={() => undefined}
        onClose={() => setPickerOpen(false)}
      />
    </>
  );
}
