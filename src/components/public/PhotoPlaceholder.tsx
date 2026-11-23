/** Neutral placeholder for a photo that has not been supplied yet. No stock or generated images. The box keeps its aspect ratio so real photos drop in without layout shift. */
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
      aria-label={`Photo coming soon: ${description}`}
    >
      <div>
        <strong>Photo coming soon</strong>
      </div>
    </div>
  );
}
