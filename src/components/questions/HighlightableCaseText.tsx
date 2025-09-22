"use client";

import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RichTextDisplay, hasInlineImages, extractPlainText } from '@/components/ui/rich-text-display';

export type CaseTextHighlight = { start: number; end: number; color?: string };

function mergeRanges(ranges: CaseTextHighlight[]): CaseTextHighlight[] {
  if (!ranges.length) return [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: CaseTextHighlight[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = sorted[i];
    // Only merge if they overlap AND have the same color
    if (curr.start <= prev.end && prev.color === curr.color) {
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

  // Load highlights from backend or localStorage (following user-question-state pattern)
  useEffect(() => {
    let aborted = false;
    async function loadFromApi() {
      if (!user?.id) {
        // Try localStorage fallback for anonymous users
        try {
          const raw = localStorage.getItem(storageKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) setHighlights(parsed);
            else setHighlights([]);
          } else {
            setHighlights([]);
          }
        } catch {
          setHighlights([]);
        }
        return;
      }

      try {
        // Use the same pattern as HighlightableQuestionText
        const res = await fetch(`/api/user-case-highlights?userId=${user.id}&questionId=case-text-${lectureId}`);
        if (!res.ok) {
          // API failed, try localStorage
          const raw = localStorage.getItem(storageKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) setHighlights(parsed);
            else setHighlights([]);
          } else {
            setHighlights([]);
          }
          return;
        }
        
        const data = await res.json();
        if (aborted) return;
        
        if (data?.highlights && Array.isArray(data.highlights)) {
          const textLength = plainText.length;
          const sanitized = (data.highlights as CaseTextHighlight[])
            .filter(r => typeof r?.start === 'number' && typeof r?.end === 'number')
            .map(r => ({ 
              start: Math.max(0, Math.min(r.start, textLength)), 
              end: Math.max(0, Math.min(r.end, textLength)),
              color: r.color || user?.highlightColor || '#fde68a'
            }))
            .filter(r => r.end > r.start);
          
          if (JSON.stringify(sanitized) !== JSON.stringify(highlights)) {
            setHighlights(sanitized);
            try { localStorage.setItem(storageKey, JSON.stringify(sanitized)); } catch {}
          }
        } else {
          // API returned no highlights, try localStorage
          const raw = localStorage.getItem(storageKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) setHighlights(parsed);
            else setHighlights([]);
          } else {
            setHighlights([]);
          }
        }
      } catch {
        // API failed, fallback to localStorage
        try {
          const raw = localStorage.getItem(storageKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) setHighlights(parsed);
            else setHighlights([]);
          } else {
            setHighlights([]);
          }
        } catch {
          setHighlights([]);
        }
      }
    }
    loadFromApi();
    return () => { aborted = true; };
  }, [user?.id, lectureId, storageKey, plainText.length, user?.highlightColor]);

  // Persist highlights to localStorage and backend (following user-question-state pattern)
  const saveTimer = useRef<number | null>(null);
  useEffect(() => {
    // Save to localStorage immediately
    try {
      localStorage.setItem(storageKey, JSON.stringify(highlights));
    } catch (error) {
      console.error('Error saving highlights to localStorage:', error);
    }
    
    // Debounced save to backend (same pattern as HighlightableQuestionText)
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
    }
    saveTimer.current = window.setTimeout(async () => {
      if (user?.id) {
        try {
          // First get current notes (like HighlightableQuestionText does)
          const res = await fetch(`/api/user-case-highlights?userId=${user.id}&questionId=case-text-${lectureId}`);
          const data = res.ok ? await res.json() : {};
          const currentNotes = data?.notes || '';
          
          // Save highlights and notes
          await fetch('/api/user-case-highlights', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              userId: user.id, 
              questionId: `case-text-${lectureId}`, 
              highlights, 
              notes: currentNotes 
            }),
          });
        } catch (error) {
          console.error('Error syncing highlights and notes to server:', error);
        }
      }
    }, 400) as unknown as number;
    
    return () => {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
      }
    };
  }, [highlights, storageKey, user?.id, lectureId]);

  const commitHighlight = useCallback((selection: { start: number; end: number }) => {
    const userColor = user?.highlightColor || '#FFFF00';
    
    const newHighlight: CaseTextHighlight = {
      start: selection.start,
      end: selection.end,
      color: userColor
    };
    
    setHighlights(prev => mergeRanges([...prev, newHighlight]));
  }, [user?.highlightColor]);

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
    const segs: { text: string; highlighted: boolean; color?: string; rangeIndex?: number }[] = [];
    let cursor = 0;
    for (let i = 0; i < ranges.length; i++) {
      const r = ranges[i];
      if (r.start > cursor) segs.push({ text: plainText.slice(cursor, r.start), highlighted: false });
      segs.push({ text: plainText.slice(r.start, r.end), highlighted: true, color: r.color, rangeIndex: i });
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
          style={{
            backgroundColor: s.color || user?.highlightColor || '#fde68a', // use segment color or fallback
            borderRadius: '4px',
            padding: '0 2px',
            transition: 'background-color 0.2s',
            cursor: 'pointer'
          }}
          className="ring-1 ring-opacity-50 shadow-sm text-black hover:opacity-80"
          title="Cliquer pour retirer"
          onClick={(e)=>{ e.stopPropagation(); setHighlights(prev=>{ // remove this highlighted segment range
            const ranges = mergeRanges(prev);
            // Find the range that corresponds to this segment
            if (s.rangeIndex !== undefined && ranges[s.rangeIndex]) {
              const newRanges = [...ranges.slice(0, s.rangeIndex), ...ranges.slice(s.rangeIndex + 1)];
              return mergeRanges(newRanges);
            }
            // Fallback: find by text content matching
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
