
import { useEffect, useState } from 'react';
import { Question, ClinicalCase } from '@/types';
import { QuestionItem } from './QuestionItem';
import { EmptyQuestionsState } from './EmptyQuestionsState';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

interface QuestionsListProps {
  lectureId?: string;
  refreshTrigger?: number;
}

export function QuestionsList({ lectureId, refreshTrigger }: QuestionsListProps) {
  const { t } = useTranslation();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [groupedQuestions, setGroupedQuestions] = useState<(Question | ClinicalCase)[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchQuestions();
  }, [lectureId, refreshTrigger]);

  // Group clinical case questions
  useEffect(() => {
  const regularQuestions: (Question | ClinicalCase)[] = [];
  const clinicalCaseMap = new Map<number, Question[]>();
  const multiQrocMap = new Map<number, Question[]>();

    // Group clinical case questions
    questions.forEach(question => {
      if (question.caseNumber && (question.type === 'clinic_mcq' || question.type === 'clinic_croq')) {
        if (!clinicalCaseMap.has(question.caseNumber)) {
          clinicalCaseMap.set(question.caseNumber, []);
        }
        clinicalCaseMap.get(question.caseNumber)!.push(question);
      } else if (question.caseNumber && question.type === 'qroc') {
        if (!multiQrocMap.has(question.caseNumber)) {
          multiQrocMap.set(question.caseNumber, []);
        }
        multiQrocMap.get(question.caseNumber)!.push(question);
      } else {
        regularQuestions.push(question);
      }
    });

  // Convert clinical case groups to ClinicalCase objects
    clinicalCaseMap.forEach((caseQuestions, caseNumber) => {
      // Sort questions by caseQuestionNumber
      const sortedQuestions = caseQuestions.sort((a, b) => 
        (a.caseQuestionNumber || 0) - (b.caseQuestionNumber || 0)
      );
      
      const clinicalCase: ClinicalCase = {
        caseNumber,
        caseText: sortedQuestions[0]?.caseText || '',
        questions: sortedQuestions,
        totalQuestions: sortedQuestions.length
      };
      
      regularQuestions.push(clinicalCase);
    });

    // Multi QROC: DO NOT wrap as clinical case; push individual questions back so they appear under QROC
    multiQrocMap.forEach(groupQuestions => {
      groupQuestions.forEach(q => regularQuestions.push(q));
    });

    // Sort all questions by number
    const sortedQuestions = regularQuestions.sort((a, b) => {
      const aNumber = 'caseNumber' in a ? a.caseNumber : (a.number || 0);
      const bNumber = 'caseNumber' in b ? b.caseNumber : (b.number || 0);
      return (aNumber || 0) - (bNumber || 0);
    });

    setGroupedQuestions(sortedQuestions);
  }, [questions]);

  const fetchQuestions = async () => {
    try {
      setIsLoading(true);
      const url = lectureId ? `/api/questions?lectureId=${lectureId}` : '/api/questions';
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to fetch questions');
      }
      
      const data = await response.json();
      setQuestions(data || []);
    } catch (error) {
      console.error('Error fetching questions:', error);
      toast({
        title: t('common.error'),
        description: t('common.tryAgain'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (questionId: string) => {
    // Handle edit - could open a modal or navigate to edit page
    console.log('Edit question:', questionId);
  };

  const handleDelete = async (questionId: string) => {
    try {
      const response = await fetch(`/api/questions/${questionId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete question');
      }
      
      setQuestions(questions.filter(q => q.id !== questionId));
      toast({
        title: t('common.success'),
        description: t('admin.questionDeleted'),
      });
    } catch (error) {
      console.error('Error deleting question:', error);
      toast({
        title: t('common.error'),
        description: t('common.tryAgain'),
        variant: "destructive",
      });
    }
  };

  const handleAddQuestion = () => {
    // Handle add question - could open a modal or navigate to add page
    console.log('Add question');
  };

  // Show loading state if data is being fetched
  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-pulse space-y-4 w-full">
          <div className="h-12 bg-muted rounded-md w-3/4 mx-auto"></div>
          <div className="h-24 bg-muted rounded-md"></div>
          <div className="h-24 bg-muted rounded-md"></div>
        </div>
      </div>
    );
  }

  // Show empty state if no questions available
  if (groupedQuestions.length === 0) {
    return <EmptyQuestionsState onAddQuestion={handleAddQuestion} />;
  }

  // Render questions list
  return (
    <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-1 gap-4 pr-4">
          {groupedQuestions.map((item) => {
            if ('caseNumber' in item && 'questions' in item) {
              // This is a clinical case
              const clinicalCase = item as ClinicalCase;
              
              // Add null checks for questions array
              if (!clinicalCase.questions || !Array.isArray(clinicalCase.questions)) {
                console.error('Invalid clinical case structure:', clinicalCase);
                return null;
              }
              
              return (
                <QuestionItem 
                  key={`case-${clinicalCase.caseNumber}`}
                  question={{
                    id: `case-${clinicalCase.caseNumber}`,
                    lectureId: clinicalCase.questions[0]?.lectureId || '',
                    lecture_id: clinicalCase.questions[0]?.lectureId || '',
                    type: 'clinical_case',
                    text: `Cas Clinique #${clinicalCase.caseNumber} - ${clinicalCase.totalQuestions} questions`,
                    caseNumber: clinicalCase.caseNumber,
                    caseText: clinicalCase.caseText,
                    number: clinicalCase.caseNumber
                  } as Question}
                  onEdit={() => console.log('Edit clinical case:', clinicalCase.caseNumber)}
                  onDelete={() => {
                    // Delete all questions in the clinical case
                    clinicalCase.questions.forEach(q => handleDelete(q.id));
                  }}
                  isClinicalCase={true}
                  clinicalCase={clinicalCase}
                />
              );
            } else {
              // This is a regular question
              return (
                <QuestionItem 
                  key={item.id}
                  question={item}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              );
            }
          })}
        </div>
    </div>
  );
}
