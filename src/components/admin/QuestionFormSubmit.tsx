
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Question } from '@/types';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

interface QuestionFormSubmitProps {
  questionData: Partial<Question>;
  lectureId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function QuestionFormSubmit({ 
  questionData, 
  lectureId, 
  onSuccess,
  onCancel 
}: QuestionFormSubmitProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: t('auth.notAuthenticated'),
        description: t('auth.pleaseSignIn'),
        variant: "destructive",
      });
      return;
    }
    
    if (!questionData.text?.trim()) {
      toast({
        title: t('questions.validationError'),
        description: t('questions.textRequired'),
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      const response = await fetch('/api/questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...questionData,
          lectureId: lectureId
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create question');
      }
      
      toast({
        title: t('questions.success'),
        description: t('questions.questionCreated'),
      });
      
      onSuccess?.();
      
    } catch (error: unknown) {
      console.error('Error creating question:', error);
      let errorMessage = t('common.tryAgain');
      
      if (error instanceof Error && error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: t('common.error'),
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex justify-end gap-2 mt-6">
      {onCancel && (
        <Button 
          type="button" 
          variant="outline" 
          onClick={onCancel}
          disabled={isSubmitting}
        >
          {t('common.cancel')}
        </Button>
      )}
      <Button 
        type="submit" 
        onClick={handleSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting ? t('questions.creating') : t('questions.createQuestion')}
      </Button>
    </div>
  );
}
