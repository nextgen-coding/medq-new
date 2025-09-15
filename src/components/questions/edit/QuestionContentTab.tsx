
import { QuestionType } from '@/types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RichTextInput, ImageData } from '@/components/ui/rich-text-input';

interface QuestionContentTabProps {
  questionText: string;
  setQuestionText: (text: string) => void;
  courseReminder: string;
  setCourseReminder: (text: string) => void;
  questionType: QuestionType;
  questionNumber: number | undefined;
  setQuestionNumber: (number: number | undefined) => void;
  session: string;
  setSession: (session: string) => void;
  // Inline images support
  images?: ImageData[];
  onImagesChange?: (images: ImageData[]) => void;
}

export function QuestionContentTab({ 
  questionText,
  setQuestionText,
  courseReminder,
  setCourseReminder,
  questionType,
  questionNumber,
  setQuestionNumber,
  session,
  setSession,
  images = [],
  onImagesChange
}: QuestionContentTabProps) {
  
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="space-y-2">
          <Label htmlFor="question-number">Numéro de question</Label>
          <Input 
            id="question-number"
            type="number"
            placeholder="Entrer le numéro de la question"
            value={questionNumber === undefined ? '' : questionNumber}
            onChange={(e) => {
              const value = e.target.value;
              setQuestionNumber(value === '' ? undefined : parseInt(value, 10));
            }}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="session">Session</Label>
          <Input 
            id="session"
            placeholder="Ex: Session 2022"
            value={session}
            onChange={(e) => setSession(e.target.value)}
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="question-text">Énoncé de la question</Label>
        <RichTextInput
          value={questionText}
          onChange={setQuestionText}
          images={images}
          onImagesChange={onImagesChange}
          placeholder="Saisir l'énoncé de la question"
          rows={6}
          className="min-h-24"
        />
      </div>
      
      {/* Rappel du cours removed here; handled once in parent edit component */}
    </>
  );
}