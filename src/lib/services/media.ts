/**
 * Media rehost service
 *
 * Rehosts remote image URLs to UploadThing when UPLOADTHING_TOKEN is present.
 * Falls back to returning the original URL when UploadThing isn't configured
 * or when upload fails, so imports continue to work.
 */

import { UTApi } from 'uploadthing/server';

export type RehostResult = { url: string | null; type: string | null };

const UPLOADTHING_TOKEN = process.env.UPLOADTHING_TOKEN;
const utapi = UPLOADTHING_TOKEN ? new UTApi({ token: UPLOADTHING_TOKEN }) : null;

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

function isAlreadyHosted(u: string): boolean {
  // Skip if already an UploadThing URL or a data URI
  if (u.startsWith('data:')) return true;
  try {
    const host = new URL(u).hostname;
    return host.includes('utfs.io') || host.includes('uploadthing');
  } catch {
    return false;
  }
}

export async function rehostImageIfConfigured(url: string | null): Promise<RehostResult> {
  if (!url) return { url: null, type: null };

  // If UploadThing isn't configured, just return original URL with best-effort type
  if (!utapi) {
    return { url, type: guessContentTypeFromUrl(url) || 'image' };
  }

  // Don't re-upload if already hosted on UploadThing or a data URL
  if (isAlreadyHosted(url)) {
    return { url, type: guessContentTypeFromUrl(url) || 'image' };
  }

  // Fetch the remote asset and upload via UTApi
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) {
      return { url, type: guessContentTypeFromUrl(url) || 'image' };
    }

    const contentType = res.headers.get('content-type') || guessContentTypeFromUrl(url) || 'application/octet-stream';
    const arrayBuffer = await res.arrayBuffer();

    // Build a filename based on URL/ctype
    const extFromType = contentType.split('/')[1] || 'bin';
    const urlPath = (() => { try { return new URL(url).pathname; } catch { return ''; } })();
    const baseName = urlPath ? urlPath.split('/').pop() || 'file' : 'file';
    const safeBase = baseName.split('?')[0].split('#')[0].replace(/[^a-zA-Z0-9._-]/g, '_');
    const hasExt = /\.[a-zA-Z0-9]+$/.test(safeBase);
    const filename = hasExt ? safeBase : `${safeBase}.${extFromType}`;

    // UTApi accepts File/Blob with a name property; Node may not have File, so emulate
    const blob = new Blob([arrayBuffer], { type: contentType }) as any;
    if (!('name' in blob)) {
      Object.defineProperty(blob, 'name', { value: filename, writable: false });
    }

  const uploaded = await utapi.uploadFiles(blob);
  const data: any = uploaded?.data;
  // Prefer new UploadThing fields (ufsUrl) with backwards compatibility
  const resultUrl = data?.ufsUrl || data?.ufsUUrl || data?.url || data?.appUrl || null;
    if (resultUrl) {
      return { url: resultUrl, type: contentType };
    }

    // If upload failed silently, fall back
    return { url, type: contentType };
  } catch {
    // Network or Abort; fall back to original
    return { url, type: guessContentTypeFromUrl(url) || 'image' };
  }
}
