'use client';

import React, { useState, useRef, useCallback, useEffect, useRef as _useRef } from 'react';
import { Button } from './button';
import { Textarea } from './textarea';
import { Input } from './input';
import { Label } from './label';
import { Image as ImageIcon, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useUploadThing } from '@/utils/uploadthing';

export interface ImageData {
  id: string;
  url: string;
  description: string;
  width?: number; // Custom width in pixels (optional)
}

interface RichTextInputProps {
  value: string;
  onChange: (value: string) => void;
  images?: ImageData[];
  onImagesChange?: (images: ImageData[]) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  disabled?: boolean;
  maxImageSize?: number; // in bytes, default 2MB
  hidePreview?: boolean; // Hide the preview section
  hideInstructions?: boolean; // Hide the technical instructions
  useInlineImages?: boolean; // Show images inline instead of as text
  style?: React.CSSProperties;
}

export function RichTextInput({
  value,
  onChange,
  images = [],
  onImagesChange,
  placeholder,
  rows = 4,
  className = '',
  disabled = false,
  maxImageSize = 4 * 1024 * 1024, // 4MB to match UploadThing
  hidePreview = false,
  hideInstructions = false,
  useInlineImages = false,
  style,
}: RichTextInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editorRef = useRef<HTMLDivElement>(null); // contentEditable surface when useInlineImages
  const lastRenderedValueRef = useRef<string>('');
  const internalUpdateRef = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Removed editing dialog; only inline delete now

  // Use UploadThing hook
  const { startUpload, isUploading } = useUploadThing("imageUploader", {
    onClientUploadComplete: (res) => {
      console.log("Files: ", res);
      if (res && res[0]) {
        insertImageAtCursor(res[0].url, res[0].name);
        toast({
          title: 'Image ajoutée',
          description: 'L\'image a été téléchargée et insérée dans le texte.',
        });
      }
    },
    onUploadError: (error: Error) => {
      console.error("Upload error:", error);
      toast({
        title: 'Erreur d\'upload',
        description: error.message || 'Impossible d\'ajouter l\'image.',
        variant: 'destructive',
      });
    },
  });

  // Generate unique image ID
  const generateImageId = () => `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Update images state helper
  const updateImages = (newImages: ImageData[]) => {
    if (onImagesChange) {
      onImagesChange(newImages);
    }
  };

  // One-time legacy placeholder migration: [IMAGE:url|description] -> [IMAGE:id]
  useEffect(() => {
    if (!value) return;
    // Detect legacy pattern
    const legacyRegex = /\[IMAGE:([^|]+)\|([^\]]+)\]/g;
    if (!legacyRegex.test(value)) return; // no legacy placeholders
    let working = value;
    const newImages: ImageData[] = [...images];
    // Reset regex lastIndex
    legacyRegex.lastIndex = 0;
    working = working.replace(legacyRegex, (_full, urlRaw, descRaw) => {
      const url = String(urlRaw).trim();
      const description = String(descRaw).trim();
      // Try to find existing image object by URL
      let existing = newImages.find(img => img.url === url);
      if (!existing) {
        existing = { id: generateImageId(), url, description };
        newImages.push(existing);
      }
      return `[IMAGE:${existing.id}]`;
    });
    if (working !== value) {
      updateImages(newImages);
      onChange(working);
    }
  // Intentionally exclude onChange/updateImages from deps to avoid re-run after conversion
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, images]);

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  // Clean up orphaned image references
  useEffect(() => {
    if (!value || !images.length) return;
    
    const imagePattern = /\[IMAGE:([^\]]+)\]/g;
    const imageIds = new Set(images.map(img => img.id));
    let hasOrphans = false;
    
    // Check if there are any orphaned references
    let match;
    while ((match = imagePattern.exec(value)) !== null) {
      const imageId = match[1];
      if (!imageIds.has(imageId)) {
        hasOrphans = true;
        break;
      }
    }
    
    // If we found orphans, we'll let the user clean them up manually through the UI
    // This prevents automatic removal which could be unexpected
  }, [value, images]);

  // Helper: reconstruct value string from editor DOM (contentEditable mode)
  const reconstructValueFromEditor = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return value;
    
    let result = '';
    
    const processNode = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent || '';
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tagName = el.tagName.toLowerCase();
        
        // Handle line breaks
        if (tagName === 'br') {
          return '\n';
        }
        
        // Handle div elements (usually created by Enter key)
        if (tagName === 'div') {
          let content = '';
          el.childNodes.forEach(child => {
            content += processNode(child);
          });
          // Add newline after div content (except for the first div if it's at the start)
          return content + '\n';
        }
        
        // Handle image elements
        if (el.dataset.imageId) {
          return `[IMAGE:${el.dataset.imageId}]`;
        }
        
        // Handle other elements - process their children
        let content = '';
        el.childNodes.forEach(child => {
          content += processNode(child);
        });
        return content;
      }
      return '';
    };
    
    editor.childNodes.forEach((node, index) => {
      const content = processNode(node);
      result += content;
    });
    
    // Clean up: remove trailing newline and normalize multiple newlines
    return result.replace(/\n+$/, '').replace(/\n{3,}/g, '\n\n');
  }, [value]);

  // Hoisted: update image width so both renderer & cursor insertion can use it
  const updateImageWidth = useCallback((imageId: string, newWidth: number) => {
    const updatedImages = images.map(img => img.id === imageId ? { ...img, width: newWidth } : img);
    updateImages(updatedImages);
    if (useInlineImages) {
      const editor = editorRef.current;
      if (editor) {
        const imageSpan = editor.querySelector(`[data-image-id="${imageId}"]`);
        if (imageSpan) {
          const img = imageSpan.querySelector('img');
          const widthInput = imageSpan.querySelector('input[type="number"]');
            if (img) (img as HTMLImageElement).style.width = `${newWidth}px`;
            if (widthInput) (widthInput as HTMLInputElement).value = newWidth.toString();
        }
      }
    }
  }, [images, updateImages, useInlineImages]);

  // Hoisted: create image element (was nested inside renderEditorFromValue)
  const createImageElement = useCallback((id: string) => {
    const data = images.find(i => i.id === id);
    const span = document.createElement('span');
    span.className = 'relative inline-block mx-1 my-1 align-middle group';
    span.contentEditable = 'false';
    span.dataset.imageId = id;

    if (data) {
      const img = document.createElement('img');
      img.src = data.url;
      img.alt = data.description;
      img.draggable = false;
      const currentWidth = data.width || 200;
      img.style.width = `${currentWidth}px`;
      img.style.height = 'auto';
      img.style.maxWidth = '100%';
      img.className = 'rounded border shadow-sm object-contain select-none';
      span.appendChild(img);

  const controlPanel = document.createElement('div');
  // Hidden by default; appears on hover. Positioned above image with dynamic offset.
  controlPanel.className = 'absolute left-0 bg-black/90 text-white rounded px-2 py-1 flex items-center gap-2 text-xs whitespace-nowrap z-50 shadow-lg border border-white/20 opacity-0 group-hover:opacity-100 transition-opacity';
  const isFirstLine = !span.previousSibling; // dynamic first-line detection
  controlPanel.style.top = isFirstLine ? '-30px' : '-48px';
  const widthInput = document.createElement('input');
      widthInput.type = 'number';
      widthInput.min = '50';
      widthInput.max = '800';
      widthInput.value = currentWidth.toString();
      widthInput.className = 'w-16 px-1 py-0.5 text-black rounded text-xs';
      widthInput.title = 'Largeur en pixels';

      const widthLabel = document.createElement('span');
      widthLabel.textContent = 'px';
      widthLabel.className = 'text-white/80';

      const smallBtn = document.createElement('button');
      smallBtn.textContent = 'S';
      smallBtn.title = 'Petite (150px)';
      smallBtn.className = 'bg-blue-500 hover:bg-blue-600 px-2 py-0.5 rounded text-xs';
      smallBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); updateImageWidth(id, 150); });

      const mediumBtn = document.createElement('button');
      mediumBtn.textContent = 'M';
      mediumBtn.title = 'Moyenne (250px)';
      mediumBtn.className = 'bg-blue-500 hover:bg-blue-600 px-2 py-0.5 rounded text-xs';
      mediumBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); updateImageWidth(id, 250); });

      const largeBtn = document.createElement('button');
      largeBtn.textContent = 'L';
      largeBtn.title = 'Grande (400px)';
      largeBtn.className = 'bg-blue-500 hover:bg-blue-600 px-2 py-0.5 rounded text-xs';
      largeBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); updateImageWidth(id, 400); });

      widthInput.addEventListener('change', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const newWidth = parseInt(widthInput.value) || 200;
        const clampedWidth = Math.max(50, Math.min(800, newWidth));
        widthInput.value = clampedWidth.toString();
        updateImageWidth(id, clampedWidth);
      });
      widthInput.addEventListener('keydown', (e) => { e.stopPropagation(); });

      controlPanel.appendChild(widthInput);
      controlPanel.appendChild(widthLabel);
      controlPanel.appendChild(smallBtn);
      controlPanel.appendChild(mediumBtn);
      controlPanel.appendChild(largeBtn);
      span.appendChild(controlPanel);

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'absolute top-1 right-1 h-6 w-6 p-0 bg-red-500 hover:bg-red-600 opacity-80 group-hover:opacity-100 transition-opacity rounded-full shadow-sm flex items-center justify-center z-10';
      deleteBtn.title = 'Supprimer';
      deleteBtn.innerHTML = '<svg class="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>';
      deleteBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); const pattern = new RegExp(`\\[IMAGE:${id}\\]`, 'g'); onChange(value.replace(pattern, '')); });
      span.appendChild(deleteBtn);
    } else {
      span.className += ' bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 text-xs px-2 py-1 rounded border border-amber-300 dark:border-amber-700';
      span.appendChild(document.createTextNode('Image manquante'));
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'ml-2 h-4 w-4 p-0 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center';
      deleteBtn.title = 'Supprimer cette référence';
      deleteBtn.innerHTML = '<svg class="h-2 w-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>';
      deleteBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); const pattern = new RegExp(`\\[IMAGE:${id}\\]`, 'g'); onChange(value.replace(pattern, '')); });
      span.appendChild(deleteBtn);
    }
    return span;
  }, [images, value, onChange, updateImageWidth]);

  // Helper: build DOM from value (contentEditable mode)
  const renderEditorFromValue = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (lastRenderedValueRef.current === value) return; // no-op if unchanged
    // Preserve selection to avoid caret jump
    let selStart: number | null = null;
    let selEnd: number | null = null;
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && editor.contains(selection.anchorNode)) {
      const range = selection.getRangeAt(0);
      // Helper to compute offset within editor
      const getOffset = (container: Node, offset: number) => {
        const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
        let pos = 0;
        while (walker.nextNode()) {
          const node = walker.currentNode as Text;
            if (node === container) {
              return pos + offset;
            }
            pos += node.nodeValue?.length || 0;
        }
        return pos;
      };
      selStart = getOffset(range.startContainer, range.startOffset);
      selEnd = getOffset(range.endContainer, range.endOffset);
    }
    editor.innerHTML = '';
    if (!value) { lastRenderedValueRef.current = ''; return; }
    const regex = /\[IMAGE:([^\]]+)\]/g;
    const parts: Array<{ type: 'text' | 'image'; content?: string; id?: string }> = [];
    let lastIndex = 0; let match;
    while ((match = regex.exec(value)) !== null) {
      if (match.index > lastIndex) parts.push({ type: 'text', content: value.slice(lastIndex, match.index) });
      parts.push({ type: 'image', id: match[1] });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < value.length) parts.push({ type: 'text', content: value.slice(lastIndex) });

    for (const part of parts) {
      if (part.type === 'image' && part.id) {
        editor.appendChild(createImageElement(part.id));
      } else if (part.type === 'text' && part.content) {
        const lines = part.content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i]) editor.appendChild(document.createTextNode(lines[i]));
          if (i < lines.length - 1) editor.appendChild(document.createElement('br'));
        }
      }
    }
    lastRenderedValueRef.current = value;
    // Restore selection if we had it
    if (selStart !== null && selEnd !== null && document.activeElement === editor) {
      const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
      let pos = 0; let startNode: Text | null = null; let startOffset = 0; let endNode: Text | null = null; let endOffset = 0;
      while (walker.nextNode()) {
        const node = walker.currentNode as Text;
        const len = node.nodeValue?.length || 0;
        if (!startNode && selStart <= pos + len) {
          startNode = node;
          startOffset = Math.max(0, selStart - pos);
        }
        if (!endNode && selEnd <= pos + len) {
          endNode = node;
          endOffset = Math.max(0, selEnd - pos);
          break;
        }
        pos += len;
      }
      if (startNode && endNode) {
        const newRange = document.createRange();
        newRange.setStart(startNode, startOffset);
        newRange.setEnd(endNode, endOffset);
        selection?.removeAllRanges();
        selection?.addRange(newRange);
      }
    }
  }, [value, createImageElement]);

  // Editing existing image metadata (placed early so dependent callbacks can use it)
  const editImage = useCallback((_imageId: string) => {
    // Editing disabled per request
  }, []);

  const insertImageAtCursor = useCallback((imageUrl: string, description: string = '') => {
    if (useInlineImages) {
      const editor = editorRef.current;
      if (!editor) return;
      
      // Focus the editor first to ensure it has focus
      editor.focus();
      
      const id = generateImageId();
      const newImage: ImageData = { id, url: imageUrl, description: description || 'Image', width: 200 };
      updateImages([...images, newImage]);

      // Create image element using the enhanced function
  const span = createImageElement(id);

      // Try to insert at current cursor position
      const sel = window.getSelection();
      let inserted = false;
      
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        
        // Make sure the cursor is within our editor
        if (editor.contains(range.commonAncestorContainer)) {
          try {
            range.collapse(true);
            range.insertNode(span);
            
            // Add a space after the image
            const space = document.createTextNode(' ');
            span.after(space);
            
            // Position cursor after the space
            range.setStartAfter(space);
            range.setEndAfter(space);
            sel.removeAllRanges();
            sel.addRange(range);
            
            inserted = true;
          } catch (e) {
            console.warn('Failed to insert at cursor position:', e);
          }
        }
      }
      
      // Fallback: append at the end if cursor insertion failed
      if (!inserted) {
        editor.appendChild(span);
        editor.appendChild(document.createTextNode(' '));
        
        // Try to position cursor at the end
        const range = document.createRange();
        const sel = window.getSelection();
        try {
          range.selectNodeContents(editor);
          range.collapse(false);
          sel?.removeAllRanges();
          sel?.addRange(range);
        } catch (e) {
          console.warn('Failed to position cursor at end:', e);
        }
      }

      // Update value from DOM
      internalUpdateRef.current = true;
      onChange(reconstructValueFromEditor());
      setTimeout(() => { internalUpdateRef.current = false; }, 0);
      return;
    }
    
    // Textarea fallback
    const textarea = textareaRef.current;
    if (!textarea) return;
    const cursorPos = textarea.selectionStart;
    const beforeCursor = value.substring(0, cursorPos);
    const afterCursor = value.substring(cursorPos);
    const imageId = generateImageId();
    const newImage: ImageData = { id: imageId, url: imageUrl, description: description || 'Image' };
    updateImages([...images, newImage]);
    const imageTag = `[IMAGE:${imageId}]`;
    const newValue = beforeCursor + imageTag + afterCursor;
    onChange(newValue);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(cursorPos + imageTag.length, cursorPos + imageTag.length);
    }, 0);
  }, [useInlineImages, value, images, updateImages, onChange, reconstructValueFromEditor, createImageElement]);

  const handleImageUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Type de fichier non supporté',
        description: 'Veuillez sélectionner une image.',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > maxImageSize) {
      toast({
        title: 'Image trop volumineuse',
        description: `La taille maximum est de ${Math.round(maxImageSize / (1024 * 1024))}MB.`,
        variant: 'destructive',
      });
      return;
    }

    try {
      // Show loading state
      toast({
        title: 'Upload en cours',
        description: 'Veuillez patienter...',
      });

      // Upload using UploadThing
      await startUpload([file]);
      
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Impossible d\'ajouter l\'image.',
        variant: 'destructive',
      });
    }
  }, [startUpload, maxImageSize, insertImageAtCursor]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Restore focus to editor if using inline images
      if (useInlineImages && editorRef.current) {
        editorRef.current.focus();
      }
      handleImageUpload(file);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  }, [handleImageUpload, useInlineImages]);

  // Drag and drop functionality removed per user request

  const removeImage = useCallback((imageId: string) => {
    const newImages = images.filter(img => img.id !== imageId);
    updateImages(newImages);
    if (useInlineImages) {
      const editor = editorRef.current;
      if (editor) {
        const el = editor.querySelector(`[data-image-id="${imageId}"]`);
        if (el) el.remove();
        internalUpdateRef.current = true;
        onChange(reconstructValueFromEditor());
        setTimeout(()=>{ internalUpdateRef.current = false; },0);
        return;
      }
    }
    const imagePattern = new RegExp(`\\[IMAGE:${imageId}\\]`, 'g');
    onChange(value.replace(imagePattern, ''));
  }, [images, updateImages, useInlineImages, value, onChange, reconstructValueFromEditor]);

  // (moved earlier)

  // saveImageEdit removed

  // Sync editor DOM when switching to inline mode or value changes externally
  useEffect(() => {
    if (!useInlineImages) return;
    if (internalUpdateRef.current) return; // skip internal programmatic updates
    renderEditorFromValue();
  }, [useInlineImages, value, images, renderEditorFromValue]);

  // Selection preservation helpers (treat each image span as a single token)
  const getSelectionOffsets = useCallback((): { start: number; end: number } | null => {
    const editor = editorRef.current; if (!editor) return null;
    const sel = window.getSelection(); if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return null;
    let start = -1; let end = -1; let index = 0;
    const traverse = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        if (node === range.startContainer) start = index + range.startOffset;
        if (node === range.endContainer) end = index + range.endOffset;
        index += text.length;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (el.dataset.imageId) { // image token counts as length 1
          if (el === range.startContainer) start = index; // unlikely direct
          if (el === range.endContainer) end = index + 1;
          index += 1; return; // treat atomic
        }
        el.childNodes.forEach(child => traverse(child));
      }
    };
    editor.childNodes.forEach(child => traverse(child));
    if (start === -1 || end === -1) return null;
    return { start, end };
  }, []);

  const restoreSelectionOffsets = useCallback((offsets: { start: number; end: number } | null) => {
    if (!offsets) return; const editor = editorRef.current; if (!editor) return;
    const { start, end } = offsets;
    const sel = window.getSelection(); if (!sel) return;
    let index = 0; let startNode: Node | null = null; let startOffset = 0; let endNode: Node | null = null; let endOffset = 0;
    const assign = (node: Text, globalOffset: number, target: 'start' | 'end', innerOffset: number) => {
      if (target === 'start') { startNode = node; startOffset = innerOffset; }
      else { endNode = node; endOffset = innerOffset; }
    };
    const traverse = (node: Node) => {
      if (startNode && endNode) return;
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || ''; const len = text.length;
        if (!startNode && start <= index + len) assign(node as Text, index, 'start', Math.max(0, start - index));
        if (!endNode && end <= index + len) assign(node as Text, index, 'end', Math.max(0, end - index));
        index += len;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (el.dataset.imageId) {
          // image occupies one slot; caret goes after image if inside
          if (!startNode && start <= index + 1) { startNode = el.parentNode || el; startOffset = Array.prototype.indexOf.call(startNode.childNodes, el) + 1; }
          if (!endNode && end <= index + 1) { endNode = el.parentNode || el; endOffset = Array.prototype.indexOf.call(endNode.childNodes, el) + 1; }
          index += 1; return;
        }
        el.childNodes.forEach(child => traverse(child));
      }
    };
    editor.childNodes.forEach(child => traverse(child));
    if (startNode && endNode) {
      try {
        const range = document.createRange();
        range.setStart(startNode as Node, startOffset);
        range.setEnd(endNode as Node, endOffset);
        sel.removeAllRanges(); sel.addRange(range);
      } catch {}
    }
  }, []);

  const pendingUpdateRef = useRef<number | null>(null);
  const savedSelectionRef = useRef<{ start: number; end: number } | null>(null);

  const handleEditorInput = useCallback((e: React.FormEvent<HTMLDivElement> | React.FocusEvent<HTMLDivElement>) => {
    if (!useInlineImages) return;
    e.stopPropagation();
    const editor = editorRef.current;
    if (editor) {
      editor.style.direction = 'ltr';
      editor.style.textAlign = 'left';
      editor.style.unicodeBidi = 'plaintext';
    }
    // Capture selection offsets before scheduling update
    savedSelectionRef.current = getSelectionOffsets();
    if (pendingUpdateRef.current) cancelAnimationFrame(pendingUpdateRef.current);
    pendingUpdateRef.current = requestAnimationFrame(() => {
      internalUpdateRef.current = true;
      const newVal = reconstructValueFromEditor();
      if (newVal !== value) {
        onChange(newVal);
      } else {
        // No external change; restore selection immediately
        restoreSelectionOffsets(savedSelectionRef.current);
      }
      setTimeout(() => {
        internalUpdateRef.current = false;
        // After potential parent re-render, try restoration again
        restoreSelectionOffsets(savedSelectionRef.current);
      }, 0);
    });
  }, [useInlineImages, getSelectionOffsets, reconstructValueFromEditor, value, onChange, restoreSelectionOffsets]);

  const renderPreview = () => {
    if (!value && !images.length) return null;

    const parts: Array<{ type: 'text' | 'image'; content: string; imageId?: string }> = [];
    let lastIndex = 0;
    const processedText = value;

    // Process new format images [IMAGE:id]
    const newImagePattern = /\[IMAGE:([^\]]+)\]/g;
    let match;

    while ((match = newImagePattern.exec(processedText)) !== null) {
      // Add text before image
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: processedText.substring(lastIndex, match.index)
        });
      }
      
      // Add new format image
      parts.push({
        type: 'image',
        content: match[0],
        imageId: match[1]
      });
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < processedText.length) {
      parts.push({
        type: 'text',
        content: processedText.substring(lastIndex)
      });
    }

    if (parts.length === 0 && value) {
      parts.push({ type: 'text', content: value });
    }

    return (
      <div className="mt-2 p-3 border rounded-md bg-muted/30">
        <div className="text-xs font-medium mb-2 text-muted-foreground">Aperçu:</div>
        <div className="space-y-2">
          {parts.map((part, index) => (
            <div key={index}>
              {part.type === 'text' ? (
                <p className="whitespace-pre-wrap text-sm">{part.content}</p>
              ) : (
                <div className="relative inline-block max-w-full">
                  {(() => {
                    const imageData = images.find(img => img.id === part.imageId);
                    if (!imageData) {
                      const orphanId = part.imageId!;
                      return (
                        <div className="inline-flex items-center gap-2 px-2 py-1 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded text-xs text-amber-700 dark:text-amber-200">
                          Image introuvable ({orphanId})
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 bg-red-500 hover:bg-red-600 rounded-full"
                            onClick={() => {
                              const pattern = new RegExp(`\\\[IMAGE:${orphanId}\\\]`, 'g');
                              onChange(value.replace(pattern, '')); 
                            }}
                            title="Supprimer la référence"
                          >
                            <X className="h-3 w-3 text-white" />
                          </Button>
                        </div>
                      );
                    }
                    return (
                      <div className="group inline-block relative">
                        <img
                          src={imageData.url}
                          alt={imageData.description}
                          className="max-w-[200px] max-h-[120px] h-auto rounded border shadow-sm object-contain"
                          draggable={false}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeImage(imageData.id)}
                          className="absolute top-1 right-1 h-6 w-6 p-0 bg-red-500 hover:bg-red-600 opacity-80 group-hover:opacity-100 transition-opacity rounded-full shadow-sm"
                          title="Supprimer"
                        >
                          <X className="h-3 w-3 text-white" />
                        </Button>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-2" onFocus={(e) => e.stopPropagation()} onInput={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      <div className="relative edit-input-isolation-layer" style={{ isolation: 'isolate', contain: 'layout style paint' }}>
        {useInlineImages ? (
          <div
            ref={editorRef}
            className={`force-ltr min-h-[120px] w-full p-3 rounded-md border bg-background text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-text'} ${className}`}
            contentEditable={!disabled}
            suppressContentEditableWarning
            onInput={handleEditorInput}
            onBlur={handleEditorInput}
            onFocus={(e) => { 
              e.stopPropagation(); 
              e.target.style.direction = 'ltr'; 
              e.target.style.textAlign = 'left'; 
              e.target.style.unicodeBidi = 'plaintext'; 
            }}
            onClick={(e) => { e.stopPropagation(); }}
            onKeyDown={(e) => {
              e.stopPropagation();
            }}
            role="textbox"
            aria-multiline="true"
            data-placeholder={placeholder}
            style={{ ...style, direction: 'ltr', textAlign: 'left', unicodeBidi: 'plaintext', writingMode: 'horizontal-tb', textOrientation: 'mixed' }}
            dir="ltr"
            lang="en"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck="false"
          />
        ) : (
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              e.stopPropagation();
              onChange(e.target.value);
            }}
            onFocus={(e) => {
              e.stopPropagation();
              (e.target as HTMLTextAreaElement).style.direction = 'ltr';
              (e.target as HTMLTextAreaElement).style.textAlign = 'left';
              (e.target as HTMLTextAreaElement).style.unicodeBidi = 'plaintext';
            }}
            onClick={(e) => { e.stopPropagation(); }}
            onKeyDown={(e) => {
              e.stopPropagation();
            }}
            placeholder={placeholder}
            rows={rows}
            className={`force-ltr ${className}`}
            disabled={disabled}
            style={{ ...style, direction: 'ltr', textAlign: 'left', unicodeBidi: 'plaintext', writingMode: 'horizontal-tb', textOrientation: 'mixed' }}
            dir="ltr"
            lang="en"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck="false"
          />
        )}
        {useInlineImages && <textarea className="hidden" readOnly value={value} name="rawValue" />}
      </div>
      
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            // Store current cursor position before opening file dialog
            if (useInlineImages && editorRef.current) {
              editorRef.current.focus();
            }
            fileInputRef.current?.click();
          }}
          disabled={disabled || isUploading}
        >
          <ImageIcon className="h-4 w-4 mr-2" />
          {isUploading ? 'Upload en cours...' : 'Insérer une image'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        <span className="text-xs text-muted-foreground">
          Format maximum: 4MB
        </span>
      </div>

      {!hidePreview && renderPreview()}

      {!hideInstructions && (
        <div className="text-xs text-muted-foreground space-y-1">
          <p>💡 Les images sont insérées à la position du curseur.</p>
          <p>🔧 Survolez une image pour ajuster sa taille (S/M/L) ou entrer une largeur personnalisée.</p>
          <p>🗑️ Cliquez sur le bouton rouge pour supprimer une image.</p>
        </div>
      )}

  {/* Edit dialog removed */}
    </div>
  );
}
