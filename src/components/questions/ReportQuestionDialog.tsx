
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useAuth } from '@/contexts/AuthContext';
import { Question } from '@/types';
import { toast } from '@/hooks/use-toast';

interface ReportQuestionDialogProps {
  question: Question;
  lectureId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportQuestionDialog({ 
  question, 
  lectureId,
  isOpen, 
  onOpenChange 
}: ReportQuestionDialogProps) {
  const { user } = useAuth();
  const [reason, setReason] = useState('');
  const [type, setType] = useState<'erreur_de_saisie' | 'question_hors_cours' | 'correction_erronee' | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: 'Non authentifié',
        description: 'Veuillez vous connecter.',
        variant: "destructive",
      });
      return;
    }
    
    if (!type) {
      toast({ title: 'Erreur de validation', description: 'Le type est requis', variant: 'destructive' });
      return;
    }
  // message now optional
    
    try {
      setIsSubmitting(true);
      
    const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          questionId: question.id,
          lectureId: lectureId,
      message: reason.trim(),
      reportType: type,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit report');
      }
      
      toast({
        title: 'Succès',
        description: 'Votre rapport a été soumis. Merci !',
      });
      
      // Reset form and close dialog
      setReason('');
      onOpenChange(false);
      
    } catch (error: unknown) {
      console.error('Error submitting report:', error);
  let errorMessage = 'Veuillez réessayer.';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast({
        title: 'Erreur',
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-w-[95vw] p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Signaler la question</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-2 sm:mt-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <RadioGroup value={type} onValueChange={(v) => setType(v as any)} className="grid gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="erreur_de_saisie" />
                <span>Erreur de saisie</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="question_hors_cours" />
                <span>Question hors cours</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="correction_erronee" />
                <span>Correction erronée</span>
              </label>
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reason">Raison (optionnel)</Label>
            <Textarea 
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={'Décrivez le problème (facultatif)'}
              rows={4}
            />
          </div>
          
          <div className="flex justify-end gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Envoi...' : 'Envoyer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
