/** Labelled placeholder for a client photo (Q-13). No stock or generated images. The box keeps its aspect ratio so real photos drop in without layout shift. */
export function PhotoPlaceholder({
  description,
  shape = 'photo',
  className,
}: {
  description: string;
  shape?: 'photo' | 'wide';
  className?: string;
}) {
  return (
    <div
      className={`ph ${shape}${className ? ` ${className}` : ''}`}
      role="img"
      aria-label={`Placeholder for client photo: ${description}`}
    >
      <div>
        <strong>client photo</strong>
        {description}
        <br />
        <span className="tag">placeholder, replace before launch (Q-13)</span>
      </div>
    </div>
  );
}
