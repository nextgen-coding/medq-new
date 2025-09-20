"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RichTextDisplay, hasInlineImages, extractPlainText } from '@/components/ui/rich-text-display';
import ZoomableImage from './ZoomableImage';

export type TextHighlight = { start: number; end: number };

import type { ImageData } from '@/components/ui/rich-text-display';

interface HighlightableQuestionTextProps {
  questionId: string;
  text: string;
  className?: string;
  /** When true, show a confirmation bubble (Souligner) instead of immediate highlight */
  confirmMode?: boolean;
  images?: ImageData[];
}

function mergeRanges(ranges: TextHighlight[]): TextHighlight[] {
  if (ranges.length === 0) return ranges;
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: TextHighlight[] = [sorted[0]];
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

export const HighlightableQuestionText: React.FC<HighlightableQuestionTextProps> = ({ questionId, text, className, confirmMode = false, images = [] }) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const storageKey = useMemo(() => `q-highlights:${user?.id ?? 'anon'}:${questionId}`, [user?.id, questionId]);
  const [highlights, setHighlights] = useState<TextHighlight[]>([]);
  const saveTimer = useRef<number | null>(null);
  const [pending, setPending] = useState<TextHighlight | null>(null);
  const [bubble, setBubble] = useState<{ x: number; y: number } | null>(null);
  const isSelectingRef = useRef(false);

  // Check if text contains inline images or raw image URLs
  const containsImages = hasInlineImages(text);
  const plainText = extractPlainText(text);

  // Helper: render text segment with highlights
  const renderTextSegmentWithHighlights = useCallback((segment: string, segmentOffset: number, keyPrefix: string): React.ReactNode[] => {
    if (!segment) return [];
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;
    const relevantHighlights = highlights.filter(h =>
      (h.start < segmentOffset + segment.length && h.end > segmentOffset) ||
      (h.start >= segmentOffset && h.start < segmentOffset + segment.length)
    );
    relevantHighlights.forEach((highlight, idx) => {
      const localStart = Math.max(0, highlight.start - segmentOffset);
      const localEnd = Math.min(segment.length, highlight.end - segmentOffset);
      if (localStart > lastIndex) {
        const beforeText = segment.slice(lastIndex, localStart);
        elements.push(<span key={`${keyPrefix}-before-${idx}`}>{beforeText}</span>);
      }
      if (localEnd > localStart) {
        const highlightedText = segment.slice(localStart, localEnd);
        elements.push(
          <span
            key={`${keyPrefix}-highlight-${idx}`}
            style={{
              backgroundColor: user?.highlightColor || '#fde68a',
              borderRadius: '4px',
              padding: '0 2px',
              transition: 'background-color 0.2s',
              cursor: 'pointer'
            }}
            onClick={(e) => {
              e.stopPropagation();
              setHighlights(prev => {
                const newHighlights = prev.filter(h => !(h.start === highlight.start && h.end === highlight.end));
                return mergeRanges(newHighlights);
              });
            }}
            title="Cliquez pour supprimer le surlignage"
          >
            {highlightedText}
          </span>
        );
      }
      lastIndex = localEnd;
    });
    if (lastIndex < segment.length) {
      const remainingText = segment.slice(lastIndex);
      elements.push(<span key={`${keyPrefix}-remaining`}>{remainingText}</span>);
    }
    return elements;
  }, [highlights, user?.highlightColor]);

  // Render text with highlights and images, and render raw image URLs as images (preserving highlight for other text)
  const renderHighlightedText = useCallback((): React.ReactNode => {
    if (!text) return null;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let key = 0;
    let plainTextIndex = 0;
    // Legacy images [IMAGE:url|desc]
    const legacyImageRegex = /\[IMAGE:([^|]+)\|([^\]]+)\]/g;
    let match;
    while ((match = legacyImageRegex.exec(text)) !== null) {
      const [fullMatch, imageUrl, imageDescription] = match;
      const matchStart = match.index;
      const matchEnd = matchStart + fullMatch.length;
      if (matchStart > lastIndex) {
        const textBefore = text.substring(lastIndex, matchStart);
        parts.push(...renderTextSegmentWithHighlights(textBefore, plainTextIndex, `text-${key++}`));
        plainTextIndex += textBefore.length;
      }
      parts.push(
        <ZoomableImage
          key={`image-${key++}`}
          src={imageUrl.trim()}
          alt={imageDescription.trim()}
          thumbnailClassName="inline-block max-w-full h-auto my-2"
        />
      );
      lastIndex = matchEnd;
    }
    if (parts.length > 0) {
      if (lastIndex < text.length) {
        const remainingText = text.substring(lastIndex);
        parts.push(...renderTextSegmentWithHighlights(remainingText, plainTextIndex, `text-${key++}`));
      }
      return <>{parts}</>;
    }
    // New format images [IMAGE:id]
    const newImageRegex = /\[IMAGE:([^\]]+)\]/g;
    lastIndex = 0;
    plainTextIndex = 0;
    while ((match = newImageRegex.exec(text)) !== null) {
      const [fullMatch, imageId] = match;
      const matchStart = match.index;
      const matchEnd = matchStart + fullMatch.length;
      if (matchStart > lastIndex) {
        const textBefore = text.substring(lastIndex, matchStart);
        parts.push(...renderTextSegmentWithHighlights(textBefore, plainTextIndex, `text-${key++}`));
        plainTextIndex += textBefore.length;
      }
      parts.push(
        <div key={`image-${key++}`} className="inline-block px-2 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded text-xs">
          <span className="text-amber-600">🖼️ Image</span>
        </div>
      );
      lastIndex = matchEnd;
    }
    // Now handle raw image URLs (e.g. https://...png)
    const imageUrlRegex = /https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?[^\s]*)?/gi;
    lastIndex = 0;
    let textToProcess = text;
    let urlMatch;
    while ((urlMatch = imageUrlRegex.exec(textToProcess)) !== null) {
      const [fullMatch] = urlMatch;
      const matchStart = urlMatch.index;
      const matchEnd = matchStart + fullMatch.length;
      if (matchStart > lastIndex) {
        const textBefore = textToProcess.substring(lastIndex, matchStart);
        parts.push(...renderTextSegmentWithHighlights(textBefore, plainTextIndex, `text-${key++}`));
        plainTextIndex += textBefore.length;
      }
      parts.push(
        <ZoomableImage
          key={`raw-image-${key++}`}
          src={fullMatch.trim()}
          alt="Image"
          thumbnailClassName="inline-block max-w-full h-auto my-2"
        />
      );
      lastIndex = matchEnd;
    }
    if (lastIndex < textToProcess.length) {
      const remainingText = textToProcess.substring(lastIndex);
      parts.push(...renderTextSegmentWithHighlights(remainingText, plainTextIndex, `text-${key++}`));
    }
    if (parts.length === 0) {
      return <>{renderTextSegmentWithHighlights(text, 0, 'text-0')}</>;
    }
    return <>{parts}</>;
  }, [text, highlights, user?.highlightColor, renderTextSegmentWithHighlights]);

  const highlightedContent = useMemo(() => renderHighlightedText(), [renderHighlightedText]);

  // Load highlights from backend or localStorage
  useEffect(() => {
    let aborted = false;
    async function loadFromApi() {
      if (!user?.id) return;
      try {
        const res = await fetch(`/api/user-question-state?userId=${user.id}&questionId=${questionId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (aborted) return;
        if (data?.highlights && Array.isArray(data.highlights)) {
          const textLength = containsImages ? plainText.length : text.length;
          const sanitized = (data.highlights as TextHighlight[])
            .filter(r => typeof r?.start === 'number' && typeof r?.end === 'number')
            .map(r => ({ start: Math.max(0, Math.min(r.start, textLength)), end: Math.max(0, Math.min(r.end, textLength)) }))
            .filter(r => r.end > r.start);
          if (JSON.stringify(sanitized) !== JSON.stringify(highlights)) {
            setHighlights(sanitized);
            try { localStorage.setItem(storageKey, JSON.stringify(sanitized)); } catch {}
          }
        } else {
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
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setHighlights(parsed);
          else setHighlights([]);
        } else {
          setHighlights([]);
        }
      }
    }
    loadFromApi();
    return () => { aborted = true; };
  }, [user?.id, questionId, plainText.length, storageKey, containsImages]);

  // Dismiss bubble when clicking outside/escape/scroll (confirmMode only)
  useEffect(() => {
    if (!confirmMode) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (bubble && wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setPending(null);
        setBubble(null);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPending(null);
        setBubble(null);
      }
    };
    const handleScroll = () => {
      setPending(null);
      setBubble(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [confirmMode, bubble]);

  // Save highlights to backend and localStorage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(highlights));
    } catch (error) {
      console.error('Error saving highlights to localStorage:', error);
    }
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
    }
    saveTimer.current = window.setTimeout(async () => {
      if (user?.id) {
        try {
          const res = await fetch(`/api/user-question-state?userId=${user.id}&questionId=${questionId}`);
          const data = res.ok ? await res.json() : {};
          const currentNotes = data.notes || '';
          await fetch('/api/user-question-state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, questionId, highlights, notes: currentNotes }),
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
  }, [highlights, storageKey, user?.id, questionId]);

  // Add highlight
  const addHighlight = useCallback((range: TextHighlight) => {
    if (confirmMode) {
      setPending(range);
    } else {
      setHighlights(curr => mergeRanges([...curr, range]));
    }
  }, [confirmMode]);

  // Handle mouse up for highlighting
  const handleMouseUp = useCallback(() => {
    if (!isSelectingRef.current) return;
    isSelectingRef.current = false;
    if (!wrapperRef.current) return;
    setTimeout(() => {
      if (!wrapperRef.current) return;
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      if (!wrapperRef.current.contains(range.commonAncestorContainer)) return;
      const selectedText = range.toString();
      if (!selectedText || selectedText.trim().length === 0) return;
      const plainTextContent = plainText;
      if (!plainTextContent) return;
      const selectedTextTrimmed = selectedText.trim();
      const plainTextIndex = plainTextContent.indexOf(selectedTextTrimmed);
      if (plainTextIndex === -1) {
        const words = selectedTextTrimmed.split(/\s+/);
        if (words.length > 0) {
          const firstWord = words[0];
          const lastWord = words[words.length - 1];
          const firstIndex = plainTextContent.indexOf(firstWord);
          const lastIndex = plainTextContent.lastIndexOf(lastWord);
          if (firstIndex !== -1 && lastIndex !== -1 && lastIndex > firstIndex) {
            const startOffset = firstIndex;
            const endOffset = lastIndex + lastWord.length;
            const newHighlight = { start: startOffset, end: endOffset };
            if (!confirmMode) {
              addHighlight(newHighlight);
              if (newHighlight.start >= 0 && newHighlight.end > newHighlight.start) {
                selection.removeAllRanges();
              }
            } else {
              setPending(newHighlight);
              const rect = range.getBoundingClientRect();
              const wrapperRect = wrapperRef.current.getBoundingClientRect();
              setBubble({
                x: rect.left - wrapperRect.left + (rect.width / 2),
                y: rect.top - wrapperRect.top - 10
              });
            }
            return;
          }
        }
        return;
      }
      const startOffset = plainTextIndex;
      const endOffset = plainTextIndex + selectedTextTrimmed.length;
      const newHighlight = { start: startOffset, end: endOffset };
      if (!confirmMode) {
        addHighlight(newHighlight);
        if (newHighlight.start >= 0 && newHighlight.end > newHighlight.start) {
          selection.removeAllRanges();
        }
      } else {
        setPending(newHighlight);
        const rect = range.getBoundingClientRect();
        const wrapperRect = wrapperRef.current.getBoundingClientRect();
        setBubble({
          x: rect.left - wrapperRect.left + (rect.width / 2),
          y: rect.top - wrapperRect.top - 10
        });
      }
    }, 10);
  }, [addHighlight, confirmMode, plainText]);

  // Handle mouse down for selection
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target && (target.tagName === 'SPAN' || target.tagName === 'P' || target.tagName === 'DIV' || target.textContent)) {
      isSelectingRef.current = true;
    }
  }, []);

  // Apply pending highlight on wrapper click (confirm mode)
  const handleWrapperClick = useCallback((e: React.MouseEvent) => {
    if (confirmMode && pending) {
      e.stopPropagation();
      setHighlights(curr => mergeRanges([...curr, pending]));
      setPending(null);
      setBubble(null);
    }
  }, [confirmMode, pending]);

  return (
    <div
      ref={wrapperRef}
      className={`relative cursor-text select-text ${className}`}
      onClick={handleWrapperClick}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onTouchEnd={handleMouseUp}
    >
      {highlightedContent}
      {confirmMode && bubble && pending && (
        <div
          className="absolute z-50 -translate-x-1/2 -translate-y-full bg-white dark:bg-neutral-900 border rounded shadow px-2 py-1 flex items-center gap-2 text-xs"
          style={{ left: bubble.x, top: Math.max(0, bubble.y - 6) }}
        >
          <button
            className="px-2 py-0.5 rounded bg-lime-300 text-black hover:bg-lime-200 ring-1 ring-lime-400 shadow-[0_0_4px_rgba(163,230,53,0.8)]"
            onClick={(e)=>{ e.stopPropagation(); setHighlights(curr=>mergeRanges([...curr, pending!])); setBubble(null); setPending(null); const sel=window.getSelection(); sel?.removeAllRanges(); }}
          >Souligner</button>
        </div>
      )}
    </div>
  );
};
