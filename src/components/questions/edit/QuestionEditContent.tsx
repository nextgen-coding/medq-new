
import { Question } from '@/types';
import { QuestionContentTab } from './QuestionContentTab';
import { AnswersExplanationsTab } from './AnswersExplanationsTab';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RichTextInput, ImageData } from '@/components/ui/rich-text-input';
import { useEffect, useState } from 'react';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { QuickParseQroc as SharedQuickParseQroc } from '../QuickParseQroc';

interface QuestionEditContentProps {
  question: Question;
  questionText: string;
  setQuestionText: (text: string) => void;
  courseReminder: string;
  setCourseReminder: (text: string) => void;
  questionNumber: number | undefined;
  setQuestionNumber: (number: number | undefined) => void;
  session: string;
  setSession: (session: string) => void;
  options: { id: string; text: string; explanation?: string }[];
  updateOptionText: (id: string, text: string) => void;
  updateOptionExplanation: (id: string, explanation: string) => void;
  correctAnswers: string[];
  toggleCorrectAnswer: (id: string) => void;
  setCorrectAnswers: (answers: string[]) => void;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  handleMediaChange: (url: string | undefined, type: 'image' | 'video' | undefined) => void;
  reminderMediaUrl?: string;
  reminderMediaType?: 'image' | 'video';
  handleReminderMediaChange: (url: string | undefined, type: 'image' | 'video' | undefined) => void;
  isLoading: boolean;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
  // Lifted inline images state (controlled by parent hook)
  images: ImageData[];
  onImagesChange: (images: ImageData[]) => void;
}

export function QuestionEditContent({
  question,
  questionText,
  setQuestionText,
  courseReminder,
  setCourseReminder,
  questionNumber,
  setQuestionNumber,
  session,
  setSession,
  options,
  updateOptionText,
  updateOptionExplanation,
  correctAnswers,
  toggleCorrectAnswer,
  setCorrectAnswers,
  mediaUrl,
  mediaType,
  handleMediaChange,
  reminderMediaUrl,
  reminderMediaType,
  handleReminderMediaChange,
  isLoading,
  onCancel,
  onSubmit,
  images,
  onImagesChange,
}: QuestionEditContentProps) {
  const [imagesInitialized, setImagesInitialized] = useState(false as any); // retained flag but images controlled by parent

  // Initialize images from question content on first load
  useEffect(() => {
    if (!imagesInitialized && question) {
      const extractedImages: ImageData[] = [];
      
      // Helper to extract images from legacy format [IMAGE:url|description] and convert to new format
      const extractLegacyImages = (text: string) => {
        if (!text) return;
        
        // Look for legacy image format [IMAGE:url|description]
        const legacyImageRegex = /\[IMAGE:([^|]+)\|([^\]]+)\]/g;
        let match;
        while ((match = legacyImageRegex.exec(text)) !== null) {
          const url = match[1].trim();
          const description = match[2].trim();
          const id = `legacy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          // Only add if we haven't seen this image before
          if (!extractedImages.find(img => img.url === url)) {
            extractedImages.push({
              id,
              url,
              description
            });
          }
        }
      };

      // Helper to extract image IDs from new format [IMAGE:id] and create placeholder entries
      const extractImageIds = (text: string) => {
        if (!text) return;
        
        // Look for image placeholders [IMAGE:id] in the text
        const imageRegex = /\[IMAGE:([^\]]+)\]/g;
        let match;
        while ((match = imageRegex.exec(text)) !== null) {
          const imageId = match[1];
          // Skip if it looks like a URL (legacy format)
          if (imageId.includes('http') || imageId.includes('|')) return;
          
          // Only add if we haven't seen this ID before
          if (!extractedImages.find(img => img.id === imageId)) {
            extractedImages.push({
              id: imageId,
              url: 'https://via.placeholder.com/300x150/e2e8f0/64748b?text=' + encodeURIComponent(`Image: ${imageId.slice(0, 8)}...`),
              description: `Image ${imageId}`
            });
          }
        }
      };

      // Extract images from all text fields - both legacy and new formats
      const allTexts = [
        questionText,
        courseReminder,
        ...(options?.map(opt => opt.text || '') || []),
        ...(options?.map(opt => opt.explanation || '') || []),
        ...(correctAnswers || [])
      ];

      allTexts.forEach(text => {
        extractLegacyImages(text);
        extractImageIds(text);
      });

      if (extractedImages.length > 0) {
        // Merge with existing parent images (avoid duplicates by id or url)
        const merged = [...images];
        extractedImages.forEach(img => {
          if (!merged.find(m => m.id === img.id || m.url === img.url)) merged.push(img);
        });
        if (merged.length !== images.length) onImagesChange(merged);
      }
      setImagesInitialized(true);
    }
  }, [question, questionText, courseReminder, options, correctAnswers, imagesInitialized, images, onImagesChange]);
  
  return (
    <form onSubmit={onSubmit} className="space-y-6 mt-2">
      {/* Parsing rapide (ajouté pour QROC & CAS QROC) */}
      {(question.type === 'qroc' || question.type === 'clinic_croq') && (
        <SharedQuickParseQroc
          questionText={questionText}
          answer={correctAnswers[0] || ''}
          setQuestionText={setQuestionText}
          setAnswer={(a)=> setCorrectAnswers([a])}
          autoPrefill
          title="Parse rapide"
        />
      )}
      {/* Core content fields */}
      <QuestionContentTab
        questionText={questionText}
        setQuestionText={setQuestionText}
        courseReminder={courseReminder}
        setCourseReminder={setCourseReminder}
        questionType={question.type}
        questionNumber={questionNumber}
        setQuestionNumber={setQuestionNumber}
        session={session}
        setSession={setSession}
        images={images}
        onImagesChange={onImagesChange}
      />

      {/* QROC / clinic_croq reference answer (single) */}
      {(question.type === 'qroc' || question.type === 'clinic_croq') && (
        <div className="space-y-2">
          <h3 className="text-base font-semibold">Réponse de référence</h3>
          <RichTextInput
            value={correctAnswers[0] || ''}
            onChange={(text) => setCorrectAnswers([text])}
            images={images}
            onImagesChange={onImagesChange}
            placeholder="Saisir la réponse attendue"
            rows={3}
          />
          <p className="text-xs text-muted-foreground">Affichée après soumission pour l'auto-évaluation.</p>
        </div>
      )}

      {/* Quick bulk edit (question + options) */}
      {(question.type === 'mcq' || question.type === 'clinic_mcq') && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold">Édition rapide (question + options)</h3>
          <BulkEditArea
            questionText={questionText}
            options={options}
            correctAnswers={correctAnswers}
            setQuestionText={setQuestionText}
            updateOptionText={updateOptionText}
            toggleCorrectAnswer={toggleCorrectAnswer}
          />
        </div>
      )}


      {/* MCQ answers/explanations */}
      {(question.type === 'mcq' || question.type === 'clinic_mcq') && (
        <div className="space-y-4">
          <h3 className="text-base font-semibold">Réponses et explications</h3>
          <AnswersExplanationsTab
            options={options}
            correctAnswers={correctAnswers}
            updateOptionText={updateOptionText}
            updateOptionExplanation={updateOptionExplanation}
            toggleCorrectAnswer={toggleCorrectAnswer}
          />
        </div>
      )}

  {/* QROC reference answer section removed; edit form now uses unified bottom reminder/reference area */}

      {/* Unified bottom reminder / reference (single place) */}
      {(question.type === 'qroc' || question.type === 'clinic_croq' || question.type === 'mcq' || question.type === 'clinic_mcq') && (
        <div className="space-y-2">
          <h3 className="text-base font-semibold">Rappel du cours (optionnel)</h3>
          <RichTextInput
            value={courseReminder}
            onChange={setCourseReminder}
            images={images}
            onImagesChange={onImagesChange}
            placeholder={question.type === 'qroc' || question.type === 'clinic_croq' ? 'Texte de référence / rappel lié à la correction' : 'Entrer le rappel du cours'}
            rows={4}
          />
        </div>
      )}

      <Separator className="my-2" />

      <div className="flex justify-end pt-2">
        <Button 
          type="button" 
          variant="outline" 
          onClick={onCancel}
          className="mr-2"
        >
          Annuler
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Enregistrement…' : 'Enregistrer les modifications'}
        </Button>
      </div>
    </form>
  );
}

type BulkOpt = { id: string; text: string; explanation?: string };

function letterFromIndex(i: number): string {
  return String.fromCharCode('A'.charCodeAt(0) + i);
}

function formatBulk(questionText: string, options: BulkOpt[], correctAnswers: string[]): string {
  const lines: string[] = [];
  lines.push(`Q: ${questionText}`);
  options.forEach((opt, idx) => {
    const letter = letterFromIndex(idx);
    const checked = correctAnswers.includes(opt.id) ? 'x' : ' ';
    const lineText = (opt.text && opt.text.trim().length > 0) ? opt.text : `Texte de l'option ${letter}`;
    lines.push(`[${checked}] ${letter}) ${lineText}`);
    if (opt.explanation && opt.explanation.trim().length > 0) {
      const explLines = opt.explanation.split(/\r?\n/);
      explLines.forEach((l, i) => {
        if (i === 0) lines.push(`    Explication: ${l}`); else lines.push(`    ${l}`);
      });
    }
  });
  return lines.join('\n');
}

function parseBulk(text: string): { q: string; optionLines: { text: string; correct: boolean; explanation?: string }[] } {
  const rawLines = text.split(/\r?\n/);
  const cleaned = rawLines.map(l => l.replace(/\s+$/,'')).filter(l => l.trim().length > 0);
  // Accept: [x] A) txt | [ ] B. txt | A: txt | A - txt | 1) txt | 1. txt | - txt
  // Also allow lowercase letters for labels
  const optionPattern = /^\s*(?:\[((x|X)|\s)\]\s*)?(?:([A-Za-z])|(\d+))\s*[\.)\]:-]?\s*(.*)$/;
  const bulletPattern = /^[-•]\s*(.*)$/;
  const questionPattern = /^\s*Q(?:uestion)?:\s*(.*)$/i;

  const questionLines: string[] = [];
  const optionLines: { text: string; correct: boolean; explanation?: string }[] = [];
  const explanationMarker = /^(Explication|Explanation|Justification|Pourquoi|Raison)\s*[:\-]\s*/i;
  const indentedExplanation = /^\s{2,}(.*)$/; // lines starting with indentation
  let inOptions = false;

  for (let i = 0; i < cleaned.length; i++) {
    const line = cleaned[i].trim();
    const qMatch = line.match(questionPattern);
    const optMatch = line.match(optionPattern);
    const bulletMatch = line.match(bulletPattern);
    if (!inOptions) {
      // Handle explicit question line first to avoid treating "Q:" as an option label
      if (qMatch) {
        questionLines.push((qMatch[1] || '').trim());
        continue;
      }
      if (optMatch || bulletMatch) {
        inOptions = true;
      } else {
        // Accumulate freeform question text lines until options begin
        questionLines.push(line);
        continue;
      }
    }

    if (optMatch) {
      const correct = !!optMatch[2];
      const textPart = (optMatch[5] || '').trim();
      optionLines.push({ text: textPart, correct });
      continue;
    }
    if (bulletMatch) {
      const textPart = (bulletMatch[1] || '').trim();
      optionLines.push({ text: textPart, correct: false });
      continue;
    }
    if (optionLines.length > 0) {
      // treat as explanation (indented or marker) for last option
      const last = optionLines[optionLines.length - 1];
      let expl = line;
      const marker = expl.match(explanationMarker);
      if (marker) {
        expl = expl.replace(explanationMarker, '').trim();
      } else {
        const indent = expl.match(indentedExplanation);
        if (indent) expl = indent[1];
      }
      last.explanation = last.explanation ? `${last.explanation}\n${expl}` : expl;
    }
  }

  const q = questionLines.join(' ').trim();
  return { q, optionLines };
}

function BulkEditArea({
  questionText,
  options,
  correctAnswers,
  setQuestionText,
  updateOptionText,
  toggleCorrectAnswer,
  updateOptionExplanation
}: {
  questionText: string;
  options: BulkOpt[];
  correctAnswers: string[];
  setQuestionText: (t: string) => void;
  updateOptionText: (id: string, text: string) => void;
  toggleCorrectAnswer: (id: string) => void;
  updateOptionExplanation?: (id: string, explanation: string) => void;
}) {
  const [bulk, setBulk] = useState<string>(formatBulk(questionText, options, correctAnswers));

  useEffect(() => {
    setBulk(formatBulk(questionText, options, correctAnswers));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionText, options.map(o => o.text).join('|'), correctAnswers.join('|')]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bulk);
  toast({ title: 'Copié', description: 'Texte copié dans le presse-papiers.' });
    } catch {
  toast({ title: 'Erreur', description: 'Réessayez.', variant: 'destructive' });
    }
  };

  const handleApply = () => {
    const parsed = parseBulk(bulk);
    // If the question line is missing, keep the current question text instead of erroring out
    const effectiveQuestion = parsed.q?.trim() || questionText?.trim() || '';
    if (!effectiveQuestion) {
      toast({ title: 'Erreur', description: 'Format d’édition rapide invalide.', variant: 'destructive' });
      return;
    }
    setQuestionText(effectiveQuestion);

    const desired = parsed.optionLines;
    if (desired.length < 2) {
  toast({ title: 'Attention', description: 'Au moins deux options sont attendues.' });
    }
    // Ensure at least some option texts are present
    const nonEmptyDesired = desired.filter(d => d.text && d.text.trim().length > 0);
    if (nonEmptyDesired.length === 0) {
      toast({ title: 'Erreur', description: 'Aucun texte d’option détecté. Utilisez des lignes comme "A) texte" ou "[x] B) texte".', variant: 'destructive' });
      return;
    }
    // If counts differ, adjust the current options to match desired count
    if (desired.length !== options.length) {
      const makeId = () => `opt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      if (desired.length > options.length) {
        const extras = Array.from({ length: desired.length - options.length }, () => ({ id: makeId(), text: '', explanation: '' }));
        // updateOptionText can't add; so we simulate by appending virtual options via a synthetic update path below
        // We'll call update on existing ones and then fill the remainder via a fallback toast advising to add options if component doesn't reflect now.
      } else {
        // desired shorter: we'll only update the first desired.length options; others remain untouched
      }
    }
    const count = Math.min(options.length, desired.length);
    for (let i = 0; i < count; i++) {
      const opt = options[i];
      const d = desired[i];
      if (d.text !== undefined && d.text.trim() !== '' && d.text !== opt.text) {
        updateOptionText(opt.id, d.text);
      } else if ((!opt.text || opt.text.trim() === '') && (d.text === undefined || d.text.trim() === '')) {
        const letter = letterFromIndex(i);
        updateOptionText(opt.id, `Option ${letter}`);
      }
      if (d.explanation && d.explanation.trim() && updateOptionExplanation && d.explanation !== opt.explanation) {
        updateOptionExplanation(opt.id, d.explanation.trim());
      }
    }

    const desiredSet = new Set<string>();
    for (let i = 0; i < count; i++) {
      if (desired[i]?.correct) desiredSet.add(options[i].id);
    }
    const currentSet = new Set(correctAnswers);
    const allIds = new Set([...Array.from(desiredSet), ...Array.from(currentSet)].filter(id => options.some(o => o.id === id)));
    for (const id of allIds) {
      const shouldBe = desiredSet.has(id);
      const isNow = currentSet.has(id);
      if (shouldBe !== isNow) toggleCorrectAnswer(id);
    }

    if (desired.length !== options.length) {
      toast({ title: 'Note', description: 'Le nombre d’options collées diffère des options actuelles. Ajoutez ou supprimez des options si besoin, puis réappliquez.' });
    } else {
      toast({ title: 'Succès', description: 'Modifications appliquées.' });
    }
  };

  return (
    <div className="space-y-2">
      <Textarea
        value={bulk}
        onChange={(e) => setBulk(e.target.value)}
        className="min-h-40 font-mono"
  placeholder={`Q: Saisir l'énoncé de la question\n[ ] A) Texte de l'option A\n    Explication: détail pour A (indentée)\n[x] B) Texte de l'option B\n    Justification: pourquoi B\nC) Texte de l'option C`}
      />
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={handleCopy}>Copier</Button>
        <Button type="button" onClick={handleApply}>Appliquer</Button>
      </div>
    </div>
  );
}

// (Legacy inline QuickParseQroc removed; using shared component)
