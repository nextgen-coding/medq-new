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
  const initialLoadedRef = useRef(false);
  const [pending, setPending] = useState<TextHighlight | null>(null);
  const [bubble, setBubble] = useState<{ x: number; y: number } | null>(null);

  // Use a ref to track if we're currently selecting text
  const isSelectingRef = useRef(false);

  // Handle mouse down to start selection tracking
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only start tracking if we're clicking on text content
    const target = e.target as HTMLElement;
    if (target && (target.tagName === 'SPAN' || target.tagName === 'P' || target.tagName === 'DIV' || target.textContent)) {
      isSelectingRef.current = true;
    }
  }, []);

  // Use a ref to track if we're currently selecting text
  const isSelectingRef = useRef(false);

  // Handle mouse down to start selection tracking
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only start tracking if we're clicking on text content
    const target = e.target as HTMLElement;
    if (target && (target.tagName === 'SPAN' || target.tagName === 'P' || target.tagName === 'DIV' || target.textContent)) {
      isSelectingRef.current = true;
    }
  }, []);

  // Check if text contains inline images
  const containsImages = hasInlineImages(text);
  const plainText = extractPlainText(text);

  // Function to render text with highlights and images
  const renderHighlightedText = useCallback((): React.ReactNode => {
    if (!text) return null;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let key = 0;
    let plainTextIndex = 0; // Track position in plain text for highlights

    // First, handle legacy format images [IMAGE:url|description]
    const legacyImageRegex = /\[IMAGE:([^|]+)\|([^\]]+)\]/g;
    let match;

    while ((match = legacyImageRegex.exec(text)) !== null) {
      const [fullMatch, imageUrl, imageDescription] = match;
      const matchStart = match.index;
      const matchEnd = matchStart + fullMatch.length;

      // Add text before the image
      if (matchStart > lastIndex) {
        const textBefore = text.substring(lastIndex, matchStart);
        parts.push(...renderTextSegmentWithHighlights(textBefore, plainTextIndex, `text-${key++}`));
        plainTextIndex += textBefore.length;
      }

      // Add the image
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

    // If we found legacy images, we're done
    if (parts.length > 0) {
      // Add remaining text
      if (lastIndex < text.length) {
        const remainingText = text.substring(lastIndex);
        parts.push(...renderTextSegmentWithHighlights(remainingText, plainTextIndex, `text-${key++}`));
      }
      return <>{parts}</>;
    }

    // Handle new format images [IMAGE:id]
    const newImageRegex = /\[IMAGE:([^\]]+)\]/g;
    lastIndex = 0;
    plainTextIndex = 0;

    while ((match = newImageRegex.exec(text)) !== null) {
      const [fullMatch, imageId] = match;
      const matchStart = match.index;
      const matchEnd = matchStart + fullMatch.length;

      // Add text before the image
      if (matchStart > lastIndex) {
        const textBefore = text.substring(lastIndex, matchStart);
        parts.push(...renderTextSegmentWithHighlights(textBefore, plainTextIndex, `text-${key++}`));
        plainTextIndex += textBefore.length;
      }

      // Add the image (placeholder for now)
      parts.push(
        <div key={`image-${key++}`} className="inline-block px-2 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded text-xs">
          <span className="text-amber-600">🖼️ Image</span>
        </div>
      );

      lastIndex = matchEnd;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      const remainingText = text.substring(lastIndex);
      parts.push(...renderTextSegmentWithHighlights(remainingText, plainTextIndex, `text-${key++}`));
    }

    // If no images found, just render the text with highlights
    if (parts.length === 0) {
      return <>{renderTextSegmentWithHighlights(text, 0, 'text-0')}</>;
    }

    return <>{parts}</>;
  }, [text, highlights, user?.highlightColor]);

  // Helper function to render text segment with highlights
  const renderTextSegmentWithHighlights = useCallback((segment: string, segmentOffset: number, keyPrefix: string): React.ReactNode[] => {
    if (!segment) return [];

    const elements: React.ReactNode[] = [];
    let lastIndex = 0;

    // Find highlights that overlap with this segment
    const relevantHighlights = highlights.filter(h =>
      (h.start < segmentOffset + segment.length && h.end > segmentOffset) ||
      (h.start >= segmentOffset && h.start < segmentOffset + segment.length)
    );

    relevantHighlights.forEach((highlight, idx) => {
      const localStart = Math.max(0, highlight.start - segmentOffset);
      const localEnd = Math.min(segment.length, highlight.end - segmentOffset);

      // Add text before highlight
      if (localStart > lastIndex) {
        const beforeText = segment.slice(lastIndex, localStart);
        elements.push(<span key={`${keyPrefix}-before-${idx}`}>{beforeText}</span>);
      }

      // Add highlighted text
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
              // Remove this specific highlight
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

    // Add remaining text
    if (lastIndex < segment.length) {
      const remainingText = segment.slice(lastIndex);
      elements.push(<span key={`${keyPrefix}-remaining`}>{remainingText}</span>);
    }

    return elements;
  }, [highlights, user?.highlightColor]);

  // Apply highlights to the text
  const highlightedContent = useMemo(() => renderHighlightedText(), [renderHighlightedText]);


  // Always load highlights from backend on mount and when user/question changes
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
          // Basic sanity clamp - use plain text length for validation
          const textLength = containsImages ? plainText.length : text.length;
          const sanitized = (data.highlights as TextHighlight[])
            .filter(r => typeof r?.start === 'number' && typeof r?.end === 'number')
            .map(r => ({ start: Math.max(0, Math.min(r.start, textLength)), end: Math.max(0, Math.min(r.end, textLength)) }))
            .filter(r => r.end > r.start);
          // Only update highlights if different to avoid loop
          if (JSON.stringify(sanitized) !== JSON.stringify(highlights)) {
            setHighlights(sanitized);
            try { localStorage.setItem(storageKey, JSON.stringify(sanitized)); } catch {}
          }
        } else {
          // fallback to localStorage if backend empty
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
        // fallback to localStorage if fetch fails
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

    
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('scroll', handleScroll, true);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [confirmMode, bubble]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(highlights));
    } catch (error) {
      console.error('Error saving highlights to localStorage:', error);
    }

    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
    }

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

          const res = await fetch(`/api/user-question-state?userId=${user.id}&questionId=${questionId}`);
          const data = res.ok ? await res.json() : {};
          const currentNotes = data.notes || '';

          await fetch('/api/user-question-state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, questionId, highlights, notes: currentNotes }),
            body: JSON.stringify({ userId: user.id, questionId, highlights, notes: currentNotes }),
          });
        } catch (error) {
          console.error('Error syncing highlights and notes to server:', error);
        }
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

    return () => {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
      }
    };
  }, [highlights, storageKey, user?.id, questionId]);

  const addHighlight = useCallback((range: TextHighlight) => {
    if (confirmMode) {
      setPending(range);
    } else {
      setHighlights(curr => mergeRanges([...curr, range]));
    }
  }, [confirmMode, setHighlights]);
    if (confirmMode) {
      setPending(range);
    } else {
      setHighlights(curr => mergeRanges([...curr, range]));
    }
  }, [confirmMode, setHighlights]);

  const handleMouseUp = useCallback(() => {
    if (!isSelectingRef.current) return;
    isSelectingRef.current = false;

    if (!wrapperRef.current) return;

    // Add a small delay to allow the selection to stabilize
    setTimeout(() => {
      if (!wrapperRef.current) return;

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const range = selection.getRangeAt(0);
      if (!wrapperRef.current.contains(range.commonAncestorContainer)) return;
    if (!isSelectingRef.current) return;
    isSelectingRef.current = false;

    if (!wrapperRef.current) return;

    // Add a small delay to allow the selection to stabilize
    setTimeout(() => {
      if (!wrapperRef.current) return;

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const range = selection.getRangeAt(0);
      if (!wrapperRef.current.contains(range.commonAncestorContainer)) return;

    // Get the selected text
    // Get the selected text
    const selectedText = range.toString();
    if (!selectedText || selectedText.trim().length === 0) return;

    // For RichTextDisplay, we need to work with the plain text version
    const plainTextContent = plainText;
    if (!plainTextContent) return;

    // Find the selected text within the plain text
    const selectedTextTrimmed = selectedText.trim();
    const plainTextIndex = plainTextContent.indexOf(selectedTextTrimmed);

    if (plainTextIndex === -1) {
      // If exact match not found, try to find a close match
      // This handles cases where the selected text might have slight differences
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
            // Only remove selection if we successfully created a valid highlight
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

    if (!selectedText || selectedText.trim().length === 0) return;

    // For RichTextDisplay, we need to work with the plain text version
    const plainTextContent = plainText;
    if (!plainTextContent) return;

    // Find the selected text within the plain text
    const selectedTextTrimmed = selectedText.trim();
    const plainTextIndex = plainTextContent.indexOf(selectedTextTrimmed);

    if (plainTextIndex === -1) {
      // If exact match not found, try to find a close match
      // This handles cases where the selected text might have slight differences
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
            // Only remove selection if we successfully created a valid highlight
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
      // Only remove selection if we successfully created a valid highlight
      if (newHighlight.start >= 0 && newHighlight.end > newHighlight.start) {
        selection.removeAllRanges();
      }
      addHighlight(newHighlight);
      // Only remove selection if we successfully created a valid highlight
      if (newHighlight.start >= 0 && newHighlight.end > newHighlight.start) {
        selection.removeAllRanges();
      }
    } else {
      setPending(newHighlight);
      setPending(newHighlight);
      const rect = range.getBoundingClientRect();
      const wrapperRect = wrapperRef.current.getBoundingClientRect();
      setBubble({
        x: rect.left - wrapperRect.left + (rect.width / 2),
        y: rect.top - wrapperRect.top - 10
      });
      const wrapperRect = wrapperRef.current.getBoundingClientRect();
      setBubble({
        x: rect.left - wrapperRect.left + (rect.width / 2),
        y: rect.top - wrapperRect.top - 10
      });
    }
  }, 50); // Small delay to allow selection to stabilize
  }, [confirmMode, addHighlight, plainText]);

  const removeHighlightAt = useCallback((index: number) => {
    setHighlights(curr => {
      const copy = [...curr];
      if (index >= 0 && index < copy.length) {
        copy.splice(index, 1);
      }
      return copy;
  }, 50); // Small delay to allow selection to stabilize
  }, [confirmMode, addHighlight, plainText]);

  const removeHighlightAt = useCallback((index: number) => {
    setHighlights(curr => {
      const copy = [...curr];
      if (index >= 0 && index < copy.length) {
        copy.splice(index, 1);
      }
      return copy;
    });
  }, [setHighlights]);

  const clearHighlights = useCallback(() => {
    setHighlights([]);
  }, [setHighlights]);
  }, [setHighlights]);

  const clearHighlights = useCallback(() => {
    setHighlights([]);
  }, [setHighlights]);

  // Apply pending highlight on wrapper click (confirm mode)
  const handleWrapperClick = useCallback((e: React.MouseEvent) => {
    if (confirmMode && pending) {
      e.stopPropagation();
      setHighlights(curr => mergeRanges([...curr, pending]));
      setPending(null);
      setBubble(null);
    }
  }, [confirmMode, pending]);
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
      className={`relative cursor-text select-text ${className}`}
      onClick={handleWrapperClick}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onTouchEnd={handleMouseUp}
    >
      {highlightedContent}
      {confirmMode && bubble && pending && (
      {highlightedContent}
      {confirmMode && bubble && pending && (
        <div
          className="absolute z-50 bg-white border border-gray-300 rounded-md p-3 shadow-lg"
          style={{
            left: `${bubble.x}px`,
            top: `${bubble.y}px`,
            transform: 'translate(-50%, -100%)',
          }}
          className="absolute z-50 bg-white border border-gray-300 rounded-md p-3 shadow-lg"
          style={{
            left: `${bubble.x}px`,
            top: `${bubble.y}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="text-sm text-gray-700 mb-2 whitespace-nowrap">
            Surligner cette partie ?
          </div>
          <div className="flex gap-2 justify-center">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setHighlights(curr => mergeRanges([...curr, pending]));
                setPending(null);
                setBubble(null);
              }}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md shadow hover:bg-blue-500 transition-colors"
            >
              Oui
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPending(null);
                setBubble(null);
              }}
              className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded-md shadow hover:bg-gray-100 transition-colors"
            >
              Non
            </button>
          </div>
          <div className="text-sm text-gray-700 mb-2 whitespace-nowrap">
            Surligner cette partie ?
          </div>
          <div className="flex gap-2 justify-center">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setHighlights(curr => mergeRanges([...curr, pending]));
                setPending(null);
                setBubble(null);
              }}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md shadow hover:bg-blue-500 transition-colors"
            >
              Oui
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPending(null);
                setBubble(null);
              }}
              className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded-md shadow hover:bg-gray-100 transition-colors"
            >
              Non
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
