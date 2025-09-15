"use client";

import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RichTextDisplay, hasInlineImages, extractPlainText } from '@/components/ui/rich-text-display';

export type CaseTextHighlight = { start: number; end: number };

function mergeRanges(ranges: CaseTextHighlight[]): CaseTextHighlight[] {
  if (!ranges.length) return [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: CaseTextHighlight[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = sorted[i];
    if (curr.start <= prev.end) {
      prev.end = Math.max(prev.end, curr.end);
    } else {
      merged.push({ ...curr });
    }
  }
  return merged;
}

function simpleHash(input: string): string {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

interface HighlightableCaseTextProps {
  lectureId: string;
  text: string;
  className?: string;
}

export const HighlightableCaseText: React.FC<HighlightableCaseTextProps> = ({ lectureId, text, className }) => {
  const { user } = useAuth();
  
  // Check if text contains images
  const hasImages = hasInlineImages(text);
  const plainText = hasImages ? extractPlainText(text) : text;
  
  // If text contains images, just display it without highlighting functionality
  if (hasImages) {
    return (
      <div className={className}>
        <RichTextDisplay text={text} />
      </div>
    );
  }
  
  const storageKey = useMemo(() => {
    const hash = simpleHash(plainText || '');
    return `case-highlights:${user?.id ?? 'anon'}:${lectureId}:${hash}`;
  }, [user?.id, lectureId, plainText]);

  const [highlights, setHighlights] = useState<CaseTextHighlight[]>([]);
  const [pending, setPending] = useState<CaseTextHighlight | null>(null);
  const [bubble, setBubble] = useState<{ x:number; y:number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Load from storage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return setHighlights([]);
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setHighlights(parsed);
      else setHighlights([]);
    } catch {
      setHighlights([]);
    }
  }, [storageKey]);

  // Persist to storage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(mergeRanges(highlights)));
    } catch {}
  }, [storageKey, highlights]);

  const commitHighlight = useCallback((range: CaseTextHighlight) => {
    if (range.end <= range.start) return;
    setHighlights(prev => mergeRanges([...prev, range]));
  }, []);

  const handleMouseUp = useCallback(() => {
    const root = wrapperRef.current;
    if (!root) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const r = sel.getRangeAt(0);
    if (!root.contains(r.commonAncestorContainer)) return;
    const pre = document.createRange();
    pre.selectNodeContents(root);
    pre.setEnd(r.startContainer, r.startOffset);
    const start = pre.toString().length;
    const selected = r.toString();
    const end = start + selected.length;
    setPending({ start, end });
    const rect = r.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    setBubble({ x: rect.left - rootRect.left + rect.width/2, y: rect.top - rootRect.top });
  }, []);

  // Dismiss bubble on escape/outside
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setBubble(null); setPending(null); const sel = window.getSelection(); sel?.removeAllRanges(); } };
    const onDown = (e: MouseEvent) => { const t = e.target as Node; if (wrapperRef.current?.contains(t)) return; setBubble(null); setPending(null); };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, []);

  // Render text with highlights
  const segments = useMemo(() => {
    const ranges = mergeRanges(highlights);
    const segs: { text: string; highlighted: boolean }[] = [];
    let cursor = 0;
    for (const r of ranges) {
      if (r.start > cursor) segs.push({ text: plainText.slice(cursor, r.start), highlighted: false });
      segs.push({ text: plainText.slice(r.start, r.end), highlighted: true });
      cursor = r.end;
    }
    if (cursor < plainText.length) segs.push({ text: plainText.slice(cursor), highlighted: false });
    return segs;
  }, [plainText, highlights]);

  return (
    <div
      ref={wrapperRef}
  className={[className,'relative','whitespace-pre-wrap'].filter(Boolean).join(' ')}
      onMouseUp={handleMouseUp}
      onTouchEnd={handleMouseUp}
    >
      {segments.map((s,i)=> s.highlighted ? (
        <mark
          key={i}
          className="bg-lime-300/90 dark:bg-lime-300/60 ring-1 ring-lime-400 shadow-[0_0_4px_rgba(163,230,53,0.8)] text-black rounded-sm px-0.5 cursor-pointer transition-colors hover:bg-lime-200 dark:hover:bg-lime-300/70"
          title="Cliquer pour retirer"
          onClick={(e)=>{ e.stopPropagation(); setHighlights(prev=>{ // remove this highlighted segment range
            const ranges = mergeRanges(prev);
            for (let rIndex=0; rIndex<ranges.length; rIndex++) {
              const r = ranges[rIndex];
              const rLen = r.end - r.start;
              if (segments[i].text.length === rLen && segments[i].text === plainText.slice(r.start, r.end)) {
                const newRanges = [...ranges.slice(0,rIndex), ...ranges.slice(rIndex+1)];
                return mergeRanges(newRanges);
              }
            }
            return ranges; }); }}
        >
          {s.text}
        </mark>
      ) : <React.Fragment key={i}>{s.text}</React.Fragment>)}
      {bubble && pending && (
        <div
          className="absolute z-50 -translate-x-1/2 -translate-y-full bg-white dark:bg-neutral-900 border rounded shadow px-2 py-1 flex items-center gap-2 text-xs"
          style={{ left: bubble.x, top: Math.max(0, bubble.y - 6) }}
        >
          <button
            className="px-2 py-0.5 rounded bg-lime-300 text-black hover:bg-lime-200 ring-1 ring-lime-400 shadow-[0_0_4px_rgba(163,230,53,0.8)]"
            onClick={(e)=>{ e.stopPropagation(); commitHighlight(pending); setBubble(null); setPending(null); const sel=window.getSelection(); sel?.removeAllRanges(); }}
          >Souligner</button>
        </div>
      )}
    </div>
  );
};
