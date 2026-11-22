/**
 * Public URL of a published photo in the Supabase Storage `media` bucket (FR-21). Null when the backend is
 * not configured, so callers fall back to the placeholder instead of rendering a broken image.
 */
import 'server-only';
import { getSupabaseConfig } from '@/lib/env';

const BUCKET = 'media';

export function publicMediaUrl(path: string): string | null {
  const config = getSupabaseConfig();
  if (!config) return null;
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return `${config.url}/storage/v1/object/public/${BUCKET}/${encoded}`;
}
