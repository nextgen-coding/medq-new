/**
 * Media link passthrough service
 *
 * We no longer upload/rehost images. We keep the original link as-is and
 * let the frontend render it. This module now only provides content-type
 * guessing and a stable return shape.
 */

export type RehostResult = { url: string | null; type: string | null };

function guessContentTypeFromUrl(u: string | null): string | null {
  if (!u) return null;
  const ext = u.split('?')[0].split('#')[0].split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',
    tiff: 'image/tiff',
    ico: 'image/x-icon',
  };
  return (ext && map[ext]) || null;
}

// Deprecated helper kept for compatibility (no longer used)
function isAlreadyHosted(_u: string): boolean { return false; }

export async function rehostImageIfConfigured(url: string | null): Promise<RehostResult> {
  if (!url) return { url: null, type: null };
  // No rehosting: just return original URL with best-effort content-type guess
  return { url, type: guessContentTypeFromUrl(url) || 'image' };
}
