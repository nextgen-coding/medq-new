"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { StickyNote, CheckCircle2, Loader2, Trash2, Edit3, X } from 'lucide-react';
import { RichTextInput, ImageData } from '@/components/ui/rich-text-input';
import { RichTextDisplay } from '@/components/ui/rich-text-display';

interface QuestionNotesProps {
  questionId: string;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function QuestionNotes({ questionId }: QuestionNotesProps) {
  const { user } = useAuth();
  const [value, setValue] = useState('');
  const [images, setImages] = useState<ImageData[]>([]);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const lastSavedValueRef = useRef('');
  const lastSavedImagesRef = useRef<ImageData[]>([]);
  const debounceRef = useRef<NodeJS.Timeout | null>(null); // legacy; no longer used for immediate autosave
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastInputTimeRef = useRef<number>(Date.now());

  // Check if there's any content (text or images)
  const hasContent = useMemo(() => {
    return (value && value.trim()) || images.length > 0;
  }, [value, images]);

  // Check if there are unsaved changes
  const hasChanges = useMemo(() => {
    return value !== lastSavedValueRef.current || 
           JSON.stringify(images) !== JSON.stringify(lastSavedImagesRef.current);
  }, [value, images]);

  // Load existing note
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user?.id) return;
      try {
        const res = await fetch(`/api/user-question-state?userId=${user.id}&questionId=${questionId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          if (typeof data?.notes === 'string') {
            setValue(data.notes);
            lastSavedValueRef.current = data.notes;
            setLastSavedAt(new Date());
          }
          // Convert string URLs to ImageData format for compatibility
          if (Array.isArray(data?.notesImageUrls)) {
            const imageData = (data.notesImageUrls as string[]).map((url, index) => ({
              id: `legacy-${index}`,
              url: url,
              description: ''
            }));
            setImages(imageData);
            lastSavedImagesRef.current = imageData;
          }
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setInitialLoaded(true);
      }
    }
    
    // Reset state when questionId changes
    setValue('');
    setImages([]);
    setInitialLoaded(false);
    setSaveState('idle');
    setIsEditing(false);
    lastSavedValueRef.current = '';
    lastSavedImagesRef.current = [];
    load();
    return () => { 
      cancelled = true; 
      if (debounceRef.current) clearTimeout(debounceRef.current); 
    };
  }, [questionId, user?.id]);

  const save = async (silent = false) => {
    if (!user?.id) {
      if (!silent) toast({ title: 'Connexion requise', description: 'Veuillez vous connecter pour sauvegarder les notes', variant: 'destructive' });
      return;
    }
    try {
      setSaveState('saving');
      
      // Convert ImageData back to URLs for API compatibility
      const imageUrls = images.map(img => img.url);
      
      const res = await fetch('/api/user-question-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user.id, 
          questionId, 
          notes: value, 
          notesImageUrls: imageUrls 
        }),
      });
      if (!res.ok) throw new Error('Failed');
      
      lastSavedValueRef.current = value;
      lastSavedImagesRef.current = [...images];
      setLastSavedAt(new Date());
      setSaveState('saved');
      if (!silent) toast({ title: 'Sauvegardé', description: 'Votre note a été sauvegardée.' });
      
      // revert to idle after a moment
      setTimeout(() => setSaveState('idle'), 1200);
    } catch {
      setSaveState('error');
      if (!silent) toast({ title: 'Erreur', description: 'Échec de la sauvegarde de la note', variant: 'destructive' });
    }
  };

  // Inactivity-based autosave: only save if 10s of no user input and there are changes
  useEffect(() => {
    if (!initialLoaded) return;
    if (!user?.id) return;

    // Mark time of latest input whenever value/images change
    lastInputTimeRef.current = Date.now();

    // Clear existing inactivity timer
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);

    // Schedule a check in 10s
    inactivityTimerRef.current = setTimeout(() => {
      const idleFor = Date.now() - lastInputTimeRef.current;
      if (idleFor >= 10000 && hasChanges) {
        void save(true);
      }
    }, 10000);

    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [value, images, initialLoaded, user?.id, hasChanges]);

  const clearNote = async () => {
    setValue('');
    setImages([]);
    setIsEditing(false);
    // Trigger immediate save of empty value silently
    await save(true);
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
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      {saveState === 'saving' && (<><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sauvegarde…</>)}
      {saveState === 'saved' && (<><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Sauvegardé</>)}
      {saveState === 'error' && (<span className="text-red-600">Échec de la sauvegarde</span>)}
      {saveState === 'idle' && lastSavedAt && !hasChanges && (
        <span>Sauvegardé à {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      )}
    </div>
  );

  // If no content and not editing, show the input mode
  if (!hasContent && !isEditing) {
    return (
      <div className="mt-4">
        <div className="rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/10 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-md bg-primary/10 text-primary grid place-items-center">
                <StickyNote className="h-3.5 w-3.5" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">Mes Notes</span>
            </div>
            {status}
          </div>

          <RichTextInput
            value={value}
            onChange={setValue}
            images={images}
            onImagesChange={setImages}
            placeholder="Écrivez vos notes personnelles pour cette question…&#10;Vous pouvez ajouter des images en utilisant le bouton d'image dans la barre d'outils."
            className="min-h-[120px]"
          />
        </div>
      </div>
    );
  }

  // If there's content, show the card mode
  return (
    <div className="mt-4">
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-primary/10 text-primary grid place-items-center">
              <StickyNote className="h-3.5 w-3.5" />
            </div>
            <span className="text-sm font-medium">Mes Notes</span>
          </div>
          <div className="flex items-center gap-2">
            {status}
            {!isEditing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleEdit}
                className="h-7 px-2"
              >
                <Edit3 className="h-3.5 w-3.5 mr-1" />
                Modifier
              </Button>
            )}
          </div>
        </div>

        {isEditing ? (
          <>
            <RichTextInput
              value={value}
              onChange={(v) => { setValue(v); /* input timestamp handled in effect */ }}
              images={images}
              onImagesChange={(imgs) => { setImages(imgs); }}
              placeholder="Écrivez vos notes personnelles pour cette question…"
              className="min-h-[120px] mb-3"
            />
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearNote}
                disabled={!initialLoaded || (!value && images.length === 0)}
                className="text-muted-foreground"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Effacer
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelEdit}
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Annuler
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveEdit}
                  disabled={!initialLoaded || !hasChanges}
                >
                  Sauvegarder
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="prose prose-sm max-w-none">
            <RichTextDisplay
              content={value}
              images={images}
              enableImageZoom={true}
              className="text-sm leading-relaxed"
            />
          </div>
        )}
      </div>
    </div>
  );
}
