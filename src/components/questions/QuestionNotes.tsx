"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { Kalam } from 'next/font/google';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { StickyNote, CheckCircle2, Loader2, Trash2, Edit3, X } from 'lucide-react';
import { RichTextInput, ImageData } from '@/components/ui/rich-text-input';
import { RichTextDisplay } from '@/components/ui/rich-text-display';

interface QuestionNotesProps {
  questionId: string;
  onHasContentChange?: (hasContent: boolean) => void;
  autoEdit?: boolean; // Auto-enter edit mode when opened
  // Note: close handling removed – parent now solely controls visibility
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error' | 'loading';

// Handwritten style font (must be at module scope for next/font)
const handwritten = Kalam({ subsets: ['latin'], weight: ['400', '700'], display: 'swap' });

export function QuestionNotes({ questionId, onHasContentChange, autoEdit = false }: QuestionNotesProps) {
  const { user } = useAuth();
  const [value, setValue] = useState('');
  const [images, setImages] = useState<ImageData[]>([]);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const lastSavedValueRef = useRef('');
  const lastSavedImagesRef = useRef<ImageData[]>([]);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const syncDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Generate localStorage key for this question and user
  const localStorageKey = useMemo(() => {
    return `notes_${user?.id || 'guest'}_${questionId}`;
  }, [user?.id, questionId]);

  // Check if there's any content (text or images)
  const hasContent = useMemo(() => {
    return Boolean((value && value.trim()) || images.length > 0);
  }, [value, images]);

  // Notify parent when content state changes
  useEffect(() => {
    onHasContentChange?.(hasContent);
  }, [hasContent, onHasContentChange]);

  // Auto-enter edit mode when autoEdit is true and no content exists
  useEffect(() => {
    if (autoEdit && !hasContent && initialLoaded) {
      setIsEditing(true);
    }
  }, [autoEdit, hasContent, initialLoaded]);

  // Helper function to extract image IDs from content
  const extractImageIds = (content: string): string[] => {
    const imageIds: string[] = [];
    const imageRegex = /\[IMAGE:([^\]]+)\]/g;
    let match;
    while ((match = imageRegex.exec(content)) !== null) {
      imageIds.push(match[1]);
    }
    return imageIds;
  };

  // Helper function to clean content of orphaned image references
  const cleanOrphanedImages = (content: string, availableImageUrls: string[]): string => {
    if (!availableImageUrls.length) {
      // Remove all image references if no URLs available
      return content.replace(/\[IMAGE:[^\]]+\]/g, '');
    }
    
    // Extract image IDs from content
    const contentImageIds = extractImageIds(content);
    
    // Remove image references that don't have corresponding URLs
    let cleanedContent = content;
    contentImageIds.forEach((imageId, index) => {
      if (index >= availableImageUrls.length) {
        // Remove this image reference as there's no corresponding URL
        cleanedContent = cleanedContent.replace(new RegExp(`\\[IMAGE:${imageId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`, 'g'), '');
      }
    });
    
    return cleanedContent.trim();
  };

  // Check if there are unsaved changes
  const hasChanges = useMemo(() => {
    return value !== lastSavedValueRef.current || 
           JSON.stringify(images) !== JSON.stringify(lastSavedImagesRef.current);
  }, [value, images]);

  // Load from localStorage first, then sync with server
  useEffect(() => {
    let cancelled = false;
    
    // Reset state when questionId changes
    setValue('');
    setImages([]);
    setInitialLoaded(false);
    setSaveState('idle');
    setIsEditing(false);
    lastSavedValueRef.current = '';
    lastSavedImagesRef.current = [];

    const loadFromLocalStorage = () => {
      try {
        const saved = localStorage.getItem(localStorageKey);
        if (saved) {
          const data = JSON.parse(saved);
          if (data.value || data.images?.length > 0) {
            setValue(data.value || '');
            setImages(data.images || []);
            lastSavedValueRef.current = data.value || '';
            lastSavedImagesRef.current = data.images || [];
            setLastSavedAt(data.lastSavedAt ? new Date(data.lastSavedAt) : null);
          }
        }
      } catch (error) {
        console.error('Error loading from localStorage:', error);
      }
    };

    async function syncWithServer() {
      if (!user?.id || cancelled) return;
      try {
        setSaveState('loading');
        const res = await fetch(`/api/user-question-state?userId=${user.id}&questionId=${questionId}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        
        if (!cancelled) {
          let serverNotes = '';
          let serverImageUrls: string[] = [];
          
          if (typeof data?.notes === 'string') {
            serverNotes = data.notes;
          }
          
          if (Array.isArray(data?.notesImageUrls)) {
            serverImageUrls = data.notesImageUrls as string[];
          }

          // Check if we should use server data (if it's different from localStorage)
          const localData = localStorage.getItem(localStorageKey);
          let shouldUseServerData = true;
          
          if (localData) {
            try {
              const parsed = JSON.parse(localData);
              // If localStorage has data and server data is the same, don't override
              if (parsed.value === serverNotes && JSON.stringify(parsed.images?.map((img: any) => img.url) || []) === JSON.stringify(serverImageUrls)) {
                shouldUseServerData = false;
              }
            } catch (e) {
              // If parsing fails, use server data
            }
          }

          if (shouldUseServerData && (serverNotes || serverImageUrls.length > 0)) {
            // Clean orphaned image references from content
            const cleanedNotes = cleanOrphanedImages(serverNotes, serverImageUrls);
            
            // Create ImageData objects that match the actual image IDs in the content
            const contentImageIds = extractImageIds(cleanedNotes);
            const imageData = contentImageIds.map((imageId, index) => ({
              id: imageId,
              url: serverImageUrls[index] || '', // Use actual URL or empty if not available
              description: ''
            })).filter(img => img.url); // Only keep images that have valid URLs
            
            setValue(cleanedNotes);
            setImages(imageData);
            lastSavedValueRef.current = cleanedNotes;
            lastSavedImagesRef.current = imageData;
            
            const now = new Date();
            setLastSavedAt(now);

            // Save to localStorage
            localStorage.setItem(localStorageKey, JSON.stringify({
              value: cleanedNotes,
              images: imageData,
              lastSavedAt: now.toISOString()
            }));
          }
        }
      } catch (error) {
        console.error('Error syncing with server:', error);
      } finally {
        if (!cancelled) {
          setSaveState('idle');
          setInitialLoaded(true);
        }
      }
    }

    // Load from localStorage immediately for fast UI
    loadFromLocalStorage();
    
    // Then sync with server in background
    syncWithServer();

    return () => { 
      cancelled = true; 
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current);
    };
  }, [questionId, user?.id, localStorageKey]);

  const saveToLocalStorage = (content: string, imageData: ImageData[]) => {
    try {
      const now = new Date();
      localStorage.setItem(localStorageKey, JSON.stringify({
        value: content,
        images: imageData,
        lastSavedAt: now.toISOString()
      }));
      setLastSavedAt(now);
      return true;
    } catch (error) {
      console.error('Error saving to localStorage:', error);
      return false;
    }
  };

  const syncToServer = async (content: string, imageUrls: string[], silent = true) => {
    if (!user?.id) return false;
    
    try {
      const res = await fetch('/api/user-question-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user.id, 
          questionId, 
          notes: content, 
          notesImageUrls: imageUrls 
        }),
      });
      
      if (res.ok) {
        if (!silent) toast({ title: 'Synchronisé', description: 'Votre note a été synchronisée avec le serveur.' });
        return true;
      }
      throw new Error('Server sync failed');
    } catch (error) {
      console.error('Error syncing to server:', error);
      if (!silent) toast({ title: 'Erreur de synchronisation', description: 'La note est sauvée localement mais pas sur le serveur', variant: 'destructive' });
      return false;
    }
  };

  const save = async (silent = false) => {
    if (!user?.id) {
      if (!silent) toast({ title: 'Connexion requise', description: 'Veuillez vous connecter pour sauvegarder les notes', variant: 'destructive' });
      return;
    }
    
    try {
      setSaveState('saving');
      
      // Clean the content before saving
      const imageUrls = images.map(img => img.url);
      const cleanedContent = cleanOrphanedImages(value, imageUrls);
      
      // Save to localStorage immediately (fast)
      const localSaved = saveToLocalStorage(cleanedContent, images);
      
      if (localSaved) {
        // Update local state
        setValue(cleanedContent);
        lastSavedValueRef.current = cleanedContent;
        lastSavedImagesRef.current = [...images];
        setSaveState('saved');
        if (!silent) toast({ title: 'Sauvegardé', description: 'Votre note a été sauvegardée.' });
        
        // Sync to server in background with debounce
        if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current);
        syncDebounceRef.current = setTimeout(() => {
          syncToServer(cleanedContent, imageUrls, true);
        }, 2000); // 2 second delay for server sync
        
        // revert to idle after a moment
        setTimeout(() => setSaveState('idle'), 1200);
      } else {
        throw new Error('LocalStorage save failed');
      }
    } catch (error) {
      setSaveState('error');
      if (!silent) toast({ title: 'Erreur', description: 'Échec de la sauvegarde de la note', variant: 'destructive' });
    }
  };

  // Autosave on change (debounced) - fast localStorage save
  useEffect(() => {
    if (!initialLoaded) return;
    if (!hasChanges) return;
    if (!user?.id) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { void save(true); }, 500); // Faster autosave since we use localStorage
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [value, images, initialLoaded, hasChanges, user?.id]);

  const clearNote = async () => {
    setValue('');
    setImages([]);
    setIsEditing(false);
    
    // Clear localStorage immediately
    try {
      localStorage.removeItem(localStorageKey);
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }
    
    // Clear on server in background
    if (user?.id) {
      syncToServer('', [], true);
    }
    
    lastSavedValueRef.current = '';
    lastSavedImagesRef.current = [];
    setLastSavedAt(null);
    toast({ title: 'Effacé', description: 'Votre note a été effacée.' });
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    // Restore last saved values
    setValue(lastSavedValueRef.current);
    setImages([...lastSavedImagesRef.current]);
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    await save(false);
    setIsEditing(false);
  };

  const status = (
    <div className="flex items-center gap-2 text-xs">
      {saveState === 'loading' && (
  <span className="flex items-center gap-2 text-blue-700 dark:text-blue-300 bg-blue-50/90 dark:bg-blue-500/15 px-3 py-1.5 rounded-full border border-blue-300/60 dark:border-blue-400/40 shadow-sm">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> 
          Chargement…
        </span>
      )}
      {saveState === 'saving' && (
  <span className="flex items-center gap-2 text-blue-700 dark:text-blue-300 bg-blue-50/90 dark:bg-blue-500/15 px-3 py-1.5 rounded-full border border-blue-300/60 dark:border-blue-400/40 shadow-sm">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> 
          Sauvegarde…
        </span>
      )}
      {saveState === 'saved' && (
  <span className="flex items-center gap-2 text-green-700 dark:text-green-300 bg-green-50/90 dark:bg-green-500/15 px-3 py-1.5 rounded-full border border-green-300/60 dark:border-green-400/40 shadow-sm">
          <CheckCircle2 className="h-3.5 w-3.5" /> 
          Sauvegardé
        </span>
      )}
      {saveState === 'error' && (
  <span className="text-red-600 dark:text-red-300 font-medium bg-red-50/90 dark:bg-red-500/15 px-3 py-1.5 rounded-full border border-red-300/70 dark:border-red-400/50 shadow-sm">
          Échec de la sauvegarde
        </span>
      )}
      {saveState === 'idle' && lastSavedAt && !hasChanges && (
  <span className="text-gray-600 dark:text-slate-200 bg-white/70 dark:bg-slate-800/70 px-3 py-1.5 rounded-full border border-gray-300/70 dark:border-slate-600/60 shadow-sm font-medium tracking-tight">
          Sauvegardé à {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </div>
  );

  // Always show the notebook-style interface
  return (
    <div className="mt-4">
      <div className="rounded-lg overflow-hidden shadow-sm border border-gray-300 dark:border-gray-600">
        {/* Notebook-style header - Enhanced with deeper colors */}
        <div className="h-12 bg-gradient-to-r from-amber-200 to-yellow-200 border-b border-amber-400 relative shadow-sm">
          {/* Spiral binding effect */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 shadow-sm"></div>
          
          <div className="h-full flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-amber-900" />
              <span className="text-sm font-semibold text-amber-950">Mes Notes</span>
            </div>
            <div className="flex items-center gap-2">
              {status}
              {!isEditing && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleEdit}
                  className="h-7 px-2 text-xs text-amber-900 hover:bg-amber-300/70 transition-colors font-medium"
                >
                  <Edit3 className="h-3 w-3 mr-1" />
                  Modifier
                </Button>
              )}
              {isEditing && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelEdit}
                    className="h-7 px-2 text-xs text-amber-900 hover:bg-amber-300/70 font-medium"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Annuler
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveEdit}
                    disabled={!initialLoaded || !hasChanges}
                    className="h-7 px-2 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm"
                  >
                    Sauvegarder
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Lined paper content area */}
        <div className="relative bg-yellow-50 dark:bg-slate-800 min-h-[200px] notebook-lines">
          <style jsx>{`
            .notebook-lines {
              background-image: repeating-linear-gradient(
                transparent,
                transparent 23px,
                rgba(203, 213, 225, 0.3) 23px,
                rgba(203, 213, 225, 0.3) 24px
              );
            }
            .dark .notebook-lines {
              background-image: repeating-linear-gradient(
                transparent,
                transparent 23px,
                rgba(71, 85, 105, 0.4) 23px,
                rgba(71, 85, 105, 0.4) 24px
              );
            }
          `}</style>
          
          {/* Red margin line */}
          <div className="absolute left-12 top-0 bottom-0 w-px bg-red-400/60 dark:bg-red-500/70 z-10"></div>
          
          {/* Content with proper line alignment */}
          <div className="pl-16 pr-6 py-6 relative z-20">
            {isEditing || !hasContent ? (
              <>
                <RichTextInput
                  value={value}
                  onChange={setValue}
                  images={images}
                  onImagesChange={setImages}
                  placeholder={hasContent ? "Tapez votre note ici…" : "Ajouter une note..."}
                  className="min-h-[150px] mb-3 bg-transparent border-none focus-within:ring-0 focus-within:border-none text-base text-gray-800 dark:text-slate-200 placeholder:text-gray-500 dark:placeholder:text-slate-400 leading-6 [&_.ProseMirror]:outline-none [&_.ProseMirror]:border-none [&_.ProseMirror]:focus:ring-0 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-md [&_img]:shadow-sm [&_img]:my-2"
                  style={{ lineHeight: '24px' }}
                  hidePreview={true}
                  hideInstructions={true}
                  useInlineImages={true}
                />
                {hasContent && (
                  <div className="flex items-center justify-start pt-3 border-t border-gray-300/50 dark:border-slate-600/50">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearNote}
                      disabled={!initialLoaded || (!value && images.length === 0)}
                      className="h-7 px-3 text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Effacer
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-base text-gray-800 dark:text-slate-200 leading-6" style={{ lineHeight: '24px' }}>
                <RichTextDisplay
                  content={value}
                  images={images}
                  enableImageZoom={true}
                  className="text-base text-gray-800 dark:text-slate-200 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-md [&_img]:shadow-sm [&_img]:my-2 [&_img]:cursor-pointer"
                  style={{ lineHeight: '24px' }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
