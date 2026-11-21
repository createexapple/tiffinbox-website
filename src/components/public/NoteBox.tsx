import type { ReactNode } from 'react';

export function NoteBox({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="note-box">
      {title ? <h3>{title}</h3> : null}
      <p style={{ margin: 0 }}>{children}</p>
    </div>
  );
}
