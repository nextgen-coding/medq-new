"use client";

import React from 'react';
import ZoomableImage from '../questions/ZoomableImage';

export interface ImageData {
  id: string;
  url: string;
  description: string;
  width?: number; // Custom width in pixels (optional)
}

interface RichTextDisplayProps {
  // Allow undefined/null coming from older data paths safely
  content?: string | null;
  text?: string | null; // Backward compatibility
  images?: ImageData[];
  className?: string;
  enableImageZoom?: boolean; // Backward compatibility
  style?: React.CSSProperties;
}

// Helper function to check if text contains inline images
export function hasInlineImages(text?: string | null): boolean {
  if (!text) return false;
  // Use non-global regex to avoid stateful lastIndex behavior of /g with repeated calls
  const newImagePattern = /\[IMAGE:[^\]]+\]/;
  const oldImagePattern = /\[IMAGE:[^|]+\|[^\]]+\]/;
  const urlImagePattern = /https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?[^\s]*)?/i;
  return newImagePattern.test(text) || oldImagePattern.test(text) || urlImagePattern.test(text);
}

// Helper function to extract plain text (removing image placeholders and URLs)
export function extractPlainText(text?: string | null): string {
  if (!text) return "";
  return text
    .replace(/\[IMAGE:([^|]+)\|([^\]]+)\]/g, '') // Remove old format images
    .replace(/\[IMAGE:([^\]]+)\]/g, '') // Remove new format images
    .replace(/https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?[^\s]*)?/gi, '') // Remove raw image URLs
    .trim();
}

// Helper function to generate a unique ID for images
export function generateImageId(): string {
  return 'img_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
}

// Helper function to render text with line breaks
function renderTextWithLineBreaks(text: string, keyPrefix: string): React.ReactNode[] {
  if (!text) return [];
  
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]) {
      elements.push(<span key={`${keyPrefix}-line-${i}`}>{lines[i]}</span>);
    }
    if (i < lines.length - 1) {
      elements.push(<br key={`${keyPrefix}-br-${i}`} />);
    }
  }
  
  return elements;
}

export function RichTextDisplay({ content, text, images = [], className = "", enableImageZoom, style }: RichTextDisplayProps) {
  // Use text prop for backward compatibility if content is not provided
  const displayContent = content ?? text;
  const processContent = (text?: string | null): React.ReactNode[] => {
    // Normalize falsy/invalid text values
    if (text == null || typeof text !== 'string') {
      return text ? [<span key="text-0">{String(text)}</span>] : [];
    }

    const safeText = text;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let key = 0;

    // First, handle legacy format images [IMAGE:url|description] - this must come first
    const legacyImageRegex = /\[IMAGE:([^|]+)\|([^\]]+)\]/g;
    let match;

    while ((match = legacyImageRegex.exec(safeText)) !== null) {
      const [fullMatch, imageUrl, imageDescription] = match;
      const matchStart = match.index;
      const matchEnd = matchStart + fullMatch.length;

      // Add text before the image
      if (matchStart > lastIndex) {
        const textBefore = safeText.substring(lastIndex, matchStart);
        if (textBefore) {
          parts.push(...renderTextWithLineBreaks(textBefore, `text-${key++}`));
        }
      }

      // Add the image with error handling
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

    // If we found legacy images, we're done - don't process new format
    if (parts.length > 0) {
      // Add remaining text, but check for raw image URLs in the remaining text
      if (lastIndex < safeText.length) {
        const remainingText = safeText.substring(lastIndex);
        if (remainingText) {
          const remainingParts = processRawImageUrls(remainingText, key);
          parts.push(...remainingParts);
        }
      }
      return parts;
    }

    // Only process new format if no legacy images were found
    const newImageRegex = /\[IMAGE:([^\]]+)\]/g;
    lastIndex = 0; // Reset for new format processing

  while ((match = newImageRegex.exec(safeText)) !== null) {
      const [fullMatch, imageId] = match;
      const matchStart = match.index;
      const matchEnd = matchStart + fullMatch.length;

      // Add text before the image
      if (matchStart > lastIndex) {
        const textBefore = safeText.substring(lastIndex, matchStart);
        if (textBefore) {
          parts.push(...renderTextWithLineBreaks(textBefore, `text-${key++}`));
        }
      }

      // Find the image data
      const imageData = images.find(img => img.id === imageId);
      if (imageData) {
        const widthStyle = imageData.width ? `max-w-[${imageData.width}px]` : 'max-w-full';
        parts.push(
          <div key={`image-container-${key++}`} style={imageData.width ? { width: `${imageData.width}px` } : {}}>
            <ZoomableImage
              key={`image-${key++}`}
              src={imageData.url}
              alt={imageData.description}
              thumbnailClassName={`inline-block ${widthStyle} h-auto my-2`}
            />
          </div>
        );
      } else {
        // If image not found, show a more subtle placeholder or skip it entirely
        // For notes, we want to be less intrusive about missing images
        parts.push(
          <div key={`placeholder-${key++}`} className="inline-block px-2 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded text-xs">
            <span className="text-amber-600">🖼️ Image non disponible</span>
          </div>
        );
      }

      lastIndex = matchEnd;
    }

    // Add remaining text after new format images, check for raw URLs
    if (lastIndex < safeText.length) {
      const remainingText = safeText.substring(lastIndex);
      if (remainingText) {
        const remainingParts = processRawImageUrls(remainingText, key);
        parts.push(...remainingParts);
      }
    }

    // If no images found at all, process for raw image URLs
    if (parts.length === 0) {
      return processRawImageUrls(safeText, key);
    }

    return parts;
  };

  // Function to process raw image URLs in text
  const processRawImageUrls = (text: string, startKey: number): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let key = startKey;

    // Regex to match common image URLs
    const imageUrlRegex = /https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?[^\s]*)?/gi;
    let match;

    while ((match = imageUrlRegex.exec(text)) !== null) {
      const [fullMatch] = match;
      const matchStart = match.index;
      const matchEnd = matchStart + fullMatch.length;

      // Add text before the image URL
      if (matchStart > lastIndex) {
        const textBefore = text.substring(lastIndex, matchStart);
        if (textBefore) {
          parts.push(...renderTextWithLineBreaks(textBefore, `text-${key++}`));
        }
      }

      // Add the image
      parts.push(
        <div key={`raw-image-${key++}`} className="my-2">
          <ZoomableImage
            src={fullMatch.trim()}
            alt="Image"
            thumbnailClassName="inline-block max-w-full h-auto"
          />
        </div>
      );

      lastIndex = matchEnd;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      const remainingText = text.substring(lastIndex);
      if (remainingText) {
        parts.push(...renderTextWithLineBreaks(remainingText, `text-${key++}`));
      }
    }

    // If no raw image URLs found, just return the original text
    if (parts.length === 0) {
      return renderTextWithLineBreaks(text, 'text-0');
    }

    return parts;
  };

  return (
    <div className={className} style={style}>
  {processContent(displayContent)}
    </div>
  );
}

export default RichTextDisplay;
