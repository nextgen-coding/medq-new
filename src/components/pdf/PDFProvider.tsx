"use client";

// Client-only lazy pdf.js worker setup to avoid SSR DOMMatrix errors.
// We DO NOT import 'react-pdf' (and so pdfjs-dist) at module scope.

import { useEffect, useRef } from 'react';

interface WorkerWindow extends Window { __PDF_WORKER_SET__?: boolean; }

async function setupWorker(win: WorkerWindow) {
  if (win.__PDF_WORKER_SET__) return;
  try {
    const { pdfjs } = await import('react-pdf');

    // Reduce noisy console logs from pdf.js in production
    if (process.env.NODE_ENV === 'production') {
      try { (pdfjs as any).verbosity = 0; } catch {}
    }

    const envSrc = process.env.NEXT_PUBLIC_PDF_WORKER_PATH?.trim();
    const candidates: string[] = [
      envSrc,
      '/pdf.worker.min.mjs',
      '/pdf.worker.mjs',
      'https://unpkg.com/pdfjs-dist@5.3.93/build/pdf.worker.min.mjs'
    ].filter(Boolean) as string[];

    const testCandidate = async (url: string) => {
      // Skip network test for absolute external CDN (assume OK) to speed first paint
      if (/^https?:/i.test(url)) return true;
      try {
        const res = await fetch(url, { method: 'HEAD', cache: 'force-cache' });
        return res.ok && (res.headers.get('content-type') || '').includes('javascript');
      } catch {
        return false;
      }
    };

    for (const src of candidates) {
      const ok = await testCandidate(src);
      if (!ok) continue;
      try {
        pdfjs.GlobalWorkerOptions.workerSrc = src;
        win.__PDF_WORKER_SET__ = true;
        console.info('[PDFProvider] worker set ->', src);
        break;
      } catch (e) {
        console.warn('[PDFProvider] failed assign worker', src, e);
      }
    }

    // Ultimate fallback: inline blob worker (minimal) if nothing worked
    if (!win.__PDF_WORKER_SET__) {
      try {
        const minimal = "importScripts('https://unpkg.com/pdfjs-dist@5.3.93/build/pdf.worker.min.mjs');";
        const blob = new Blob([minimal], { type: 'application/javascript' });
        const blobUrl = URL.createObjectURL(blob);
        pdfjs.GlobalWorkerOptions.workerSrc = blobUrl;
        win.__PDF_WORKER_SET__ = true;
        console.info('[PDFProvider] fallback blob worker set');
      } catch (e) {
        console.error('[PDFProvider] Failed to configure any pdf.js worker', e);
      }
    }
  } catch (e) {
    console.error('[PDFProvider] dynamic import failed', e);
  }
}

export function PDFProvider({ children }: { children: React.ReactNode }) {
  const started = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!started.current) {
      started.current = true;
      void setupWorker(window as WorkerWindow);
    }
  }, []);
  return <>{children}</>;
}