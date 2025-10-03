
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

interface AnswersExplanationsTabProps {
  options: { id: string; text: string; explanation?: string; isAI?: boolean }[];
  correctAnswers: string[];
  updateOptionText: (id: string, text: string) => void;
  updateOptionExplanation: (id: string, explanation: string) => void;
  updateOptionIsAI: (id: string, isAI: boolean) => void;
  toggleCorrectAnswer: (id: string) => void;
}

export function AnswersExplanationsTab({
  options,
  correctAnswers,
  updateOptionText,
  updateOptionExplanation,
  updateOptionIsAI,
  toggleCorrectAnswer
}: AnswersExplanationsTabProps) {
  return (
    <div className="space-y-4">
      {options.map((option, index) => (
        <div key={option.id} className="border rounded-md p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center font-medium bg-muted">
              {String.fromCharCode(65 + index)}
            </div>
            
            <div className="flex-grow space-y-3">
              <div className="space-y-1">
                <Label htmlFor={`option-text-${option.id}`}>Texte de la réponse</Label>
                <Textarea
                  id={`option-text-${option.id}`}
                  value={option.text}
                  onChange={(e) => updateOptionText(option.id, e.target.value)}
                  placeholder={`Option ${String.fromCharCode(65 + index)}`}
                  rows={3}
                  className="resize-none"
                />
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center gap-2 mb-1">
                  <Label htmlFor={`option-explanation-${option.id}`} className="flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-blue-500" />
                    AI
                  </Label>
                  <input 
                    type="checkbox" 
                    checked={option.isAI || false} 
                    onChange={(e) => updateOptionIsAI(option.id, e.target.checked)}
                    className="h-3 w-3"
                  />
                </div>
                <Label htmlFor={`option-explanation-${option.id}`}>Explication</Label>
                <Textarea
                  id={`option-explanation-${option.id}`}
                  value={option.explanation || ''}
                  onChange={(e) => updateOptionExplanation(option.id, e.target.value)}
                  placeholder={`Pourquoi cette réponse est-elle correcte/incorrecte ?`}
                  rows={4}
                  className="resize-none"
                />
              </div>
            </div>
            
            <Button
              type="button"
              variant={correctAnswers.includes(option.id) ? "default" : "outline"}
              size="sm"
              className="flex-shrink-0"
              onClick={() => toggleCorrectAnswer(option.id)}
            >
              {correctAnswers.includes(option.id) ? 'Correcte' : 'Marquer comme correcte'}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
