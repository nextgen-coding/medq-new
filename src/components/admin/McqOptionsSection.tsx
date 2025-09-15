
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Check, Plus, Trash, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface McqOptionsSectionProps {
  options: { id: string; text: string; explanation?: string }[];
  setOptions: (options: { id: string; text: string; explanation?: string }[]) => void;
  correctAnswers: string[];
  setCorrectAnswers: (answers: string[]) => void;
}

export function McqOptionsSection({ 
  options, 
  setOptions, 
  correctAnswers, 
  setCorrectAnswers 
}: McqOptionsSectionProps) {
  const [expandedOptions, setExpandedOptions] = useState<string[]>([]);
  const { t } = useTranslation();
  
  const addOption = () => {
    if (options.length >= 5) return;
    const newId = String(options.length + 1);
    setOptions([...options, { id: newId, text: '' }]);
  };

  const removeOption = (idToRemove: string) => {
    if (options.length <= 2) return;
    setOptions(options.filter(option => option.id !== idToRemove));
    setCorrectAnswers(correctAnswers.filter(id => id !== idToRemove));
    setExpandedOptions(expandedOptions.filter(id => id !== idToRemove));
  };

  const updateOptionText = (id: string, text: string) => {
    setOptions(options.map(option => 
      option.id === id ? { ...option, text } : option
    ));
  };

  const updateOptionExplanation = (id: string, explanation: string) => {
    setOptions(options.map(option => 
      option.id === id ? { ...option, explanation } : option
    ));
  };

  const toggleCorrectAnswer = (id: string) => {
    if (correctAnswers.includes(id)) {
      setCorrectAnswers(correctAnswers.filter(answerId => answerId !== id));
    } else {
      setCorrectAnswers([...correctAnswers, id]);
    }
  };

  const toggleExpanded = (id: string) => {
    if (expandedOptions.includes(id)) {
      setExpandedOptions(expandedOptions.filter(optionId => optionId !== id));
    } else {
      setExpandedOptions([...expandedOptions, id]);
    }
  };
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>{t('questions.selectAllCorrect')}</Label>
        <Button 
          type="button" 
          variant="outline" 
          size="sm"
          onClick={addOption}
          disabled={options.length >= 5}
        >
          <Plus className="h-4 w-4 mr-1" />
          {t('questions.addOption')}
        </Button>
      </div>
      
      <AnimatePresence>
        {options.map((option, index) => (
          <motion.div
            key={option.id}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-2 border rounded-md p-3 bg-background"
          >
            <div className="flex items-start space-x-2">
              <Button
                type="button"
                variant={correctAnswers.includes(option.id) ? "default" : "outline"}
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={() => toggleCorrectAnswer(option.id)}
              >
                {correctAnswers.includes(option.id) ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <span className="text-sm font-medium">{String.fromCharCode(65 + index)}</span>
                )}
              </Button>
              
              <Input
                placeholder={`${t('questions.option')} ${String.fromCharCode(65 + index)}`}
                value={option.text}
                onChange={(e) => updateOptionText(option.id, e.target.value)}
                required
                className="flex-grow"
              />
              
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => toggleExpanded(option.id)}
                className="h-10 w-10 shrink-0 text-muted-foreground"
              >
                {expandedOptions.includes(option.id) ? 
                  <ChevronUp className="h-4 w-4" /> : 
                  <ChevronDown className="h-4 w-4" />
                }
              </Button>
              
              {options.length > 2 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeOption(option.id)}
                  className="h-10 w-10 shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            {expandedOptions.includes(option.id) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="pl-12 pr-2"
              >
                <Label htmlFor={`option-explanation-${option.id}`} className="text-xs mb-1 block">
                  {t('questions.optionExplanation')}
                </Label>
                <Textarea
                  id={`option-explanation-${option.id}`}
                  placeholder={t('questions.explanation')}
                  value={option.explanation || ''}
                  onChange={(e) => updateOptionExplanation(option.id, e.target.value)}
                  className="min-h-20 text-sm"
                />
              </motion.div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
