"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export type TextHighlight = { start: number; end: number };

interface HighlightableAnswerDisplayProps {
  questionId: string;
  answer: string;
  className?: string;
  /** When true, show a confirmation bubble (Souligner) instead of immediate highlight */
  confirmMode?: boolean;
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

export const HighlightableAnswerDisplay: React.FC<HighlightableAnswerDisplayProps> = ({ 
  questionId, 
  answer, 
  className, 
  confirmMode = false 
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const storageKey = useMemo(() => `answer-highlights:${user?.id ?? 'anon'}:${questionId}`, [user?.id, questionId]);
  const [highlights, setHighlights] = useState<TextHighlight[]>([]);
  const saveTimer = useRef<number | null>(null);
  const initialLoadedRef = useRef(false);
  const [pending, setPending] = useState<TextHighlight | null>(null);
  const [bubble, setBubble] = useState<{ x: number; y: number } | null>(null);

  const refreshFromStorage = useCallback(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setHighlights(mergeRanges(parsed));
        }
      }
    } catch (e) {
      console.warn('Failed to load highlights:', e);
    }
  }, [storageKey]);

  const saveToStorage = useCallback((newHighlights: TextHighlight[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(newHighlights));
      } catch (e) {
        console.warn('Failed to save highlights:', e);
      }
    }, 300);
  }, [storageKey]);

  useEffect(() => {
    if (!initialLoadedRef.current) {
      refreshFromStorage();
      initialLoadedRef.current = true;
    }
  }, [refreshFromStorage]);

  const addHighlight = useCallback((range: TextHighlight) => {
    setHighlights(prev => {
      const merged = mergeRanges([...prev, range]);
      saveToStorage(merged);
      return merged;
    });
  }, [saveToStorage]);

  const handleMouseUp = useCallback(() => {
    if (!wrapperRef.current) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    if (!wrapperRef.current.contains(range.commonAncestorContainer)) return;
    
    const textContent = wrapperRef.current.textContent || '';
    if (textContent.length === 0) return;
    
    const startOffset = range.startOffset;
    const endOffset = range.endOffset;
    
    if (startOffset === endOffset) return;
    
    const newHighlight = { start: startOffset, end: endOffset };
    
    if (!confirmMode) {
      addHighlight(newHighlight);
      selection.removeAllRanges();
    } else {
      setPending(newHighlight);
      const rect = range.getBoundingClientRect();
      setBubble({ 
        x: rect.left + (rect.width / 2), 
        y: rect.top - 10 
      });
    }
  }, [addHighlight, confirmMode]);

  // Dismiss bubble when clicking outside/escape/scroll (confirmMode only)
  useEffect(() => {
    if (!confirmMode) return;
    
    const handleClickOutside = () => {
      setBubble(null);
      setPending(null);
    };
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setBubble(null);
        setPending(null);
      }
    };
    
    const handleScroll = () => {
      setBubble(null);
      setPending(null);
    };
    
    if (bubble) {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('scroll', handleScroll, true);
    }
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [bubble, confirmMode]);

  const confirmHighlight = useCallback(() => {
    if (pending) {
      addHighlight(pending);
      setPending(null);
      setBubble(null);
      window.getSelection()?.removeAllRanges();
    }
  }, [pending, addHighlight]);

  const renderHighlightedText = () => {
    if (highlights.length === 0) {
      return answer;
    }

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    highlights.forEach((highlight, i) => {
      // Add text before highlight
      if (highlight.start > lastIndex) {
        const beforeText = answer.slice(lastIndex, highlight.start);
        parts.push(<span key={`before-${i}`}>{beforeText}</span>);
      }
      
      // Add highlighted text
      const highlightedText = answer.slice(highlight.start, highlight.end);
      parts.push(
        <span key={`highlight-${i}`} className="bg-yellow-200 dark:bg-yellow-800/50">
          {highlightedText}
        </span>
      );
      
      lastIndex = highlight.end;
    });

    // Add remaining text
    if (lastIndex < answer.length) {
      const remainingText = answer.slice(lastIndex);
      parts.push(<span key="remaining">{remainingText}</span>);
    }

    return <>{parts}</>;
  };

  if (!answer.trim()) {
    return <span className="text-muted-foreground italic">Aucune réponse</span>;
  }

  return (
    <div className="relative">
      <div
        ref={wrapperRef}
        onMouseUp={handleMouseUp}
        className={`select-text cursor-text whitespace-pre-wrap break-words ${className || ''}`}
      >
        {renderHighlightedText()}
      </div>
      
      {confirmMode && bubble && pending && (
        <div
          className="fixed z-50 bg-blue-600 text-white px-3 py-1 rounded-md text-sm font-medium shadow-lg transform -translate-x-1/2 -translate-y-full cursor-pointer hover:bg-blue-700 transition-colors"
          style={{
            left: bubble.x,
            top: bubble.y,
          }}
          onClick={confirmHighlight}
        >
          Souligner
        </div>
      )}
    </div>
  );
};
