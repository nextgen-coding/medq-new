
import { useState } from 'react';
import { Question, ClinicalCase } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Edit, 
  Trash, 
  HelpCircle, 
  PenLine, 
  Stethoscope,
  Image, 
  Video, 
  ChevronDown, 
  ChevronUp 
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useTranslation } from 'react-i18next';

interface QuestionItemProps {
  question: Question;
  onEdit: (questionId: string) => void;
  onDelete: (questionId: string) => void;
  isClinicalCase?: boolean;
  clinicalCase?: ClinicalCase;
}

export function QuestionItem({ question, onEdit, onDelete, isClinicalCase = false, clinicalCase }: QuestionItemProps) {
  const [expandedOption, setExpandedOption] = useState<string | null>(null);
  const [expandedClinicalCase, setExpandedClinicalCase] = useState(false);
  const { t } = useTranslation();
  
  const toggleOption = (optionId: string) => {
    if (expandedOption === optionId) {
      setExpandedOption(null);
    } else {
      setExpandedOption(optionId);
    }
  };

  const getQuestionTypeLabel = (type: string) => {
    switch (type) {
      case 'mcq':
        return { icon: <HelpCircle className="h-3 w-3 mr-1" />, label: t('questions.mcq') };
      case 'qroc':
        return { icon: <PenLine className="h-3 w-3 mr-1" />, label: t('questions.open') };
      case 'clinic_mcq':
        return { icon: <Stethoscope className="h-3 w-3 mr-1" />, label: t('questions.casCliniqueQcm') };
      case 'clinic_croq':
        return { icon: <Stethoscope className="h-3 w-3 mr-1" />, label: t('questions.casCliniqueQroc') };
      case 'clinical_case':
        return { icon: <Stethoscope className="h-3 w-3 mr-1" />, label: 'Cas Clinique' };
      default:
        return { icon: <HelpCircle className="h-3 w-3 mr-1" />, label: type };
    }
  };

  const typeInfo = getQuestionTypeLabel(question.type);
  
  return (
    <Card key={question.id}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted">
                {typeInfo.icon}
                {typeInfo.label}
              </div>
              {question.number !== null && question.number !== undefined && (
                <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800">
                  #{question.number}
                </div>
              )}
              {question.session && (
                <div className="text-xs text-muted-foreground">
                  {question.session}
                </div>
              )}
              {question.media_type && (
                <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  {question.media_type === 'image' ? (
                    <>
                      <Image className="h-3 w-3 mr-1" />
                      Image
                    </>
                  ) : (
                    <>
                      <Video className="h-3 w-3 mr-1" />
                      Video
                    </>
                  )}
                </div>
              )}
            </div>
            <CardTitle className="text-base">{question.text}</CardTitle>
          </div>
          <div className="flex space-x-2">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => onEdit(question.id)}
            >
              <Edit className="h-4 w-4" />
            </Button>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-destructive">
                  <Trash className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {isClinicalCase ? 'Delete Clinical Case' : 'Delete Question'}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {isClinicalCase 
                      ? 'Are you sure you want to delete this clinical case and all its questions? This action cannot be undone.'
                      : 'Are you sure you want to delete this question? This action cannot be undone.'
                    }
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => onDelete(question.id)}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="text-sm">
        {/* Clinical Case Content */}
        {isClinicalCase && clinicalCase && (
          <div className="space-y-4">
            <div className="border rounded-md p-3 bg-muted/50">
              <div className="font-medium mb-2">Cas Clinique #{clinicalCase.caseNumber}</div>
              <div className="text-sm text-muted-foreground mb-3">{clinicalCase.caseText}</div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpandedClinicalCase(!expandedClinicalCase)}
                className="w-full justify-between"
              >
                <span>Voir les {clinicalCase.totalQuestions} questions</span>
                {expandedClinicalCase ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>

            {expandedClinicalCase && (
              <div className="space-y-3">
                {clinicalCase.questions.map((caseQuestion, index) => (
                  <div key={caseQuestion.id} className="border rounded-md p-3 bg-background">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        Question {index + 1}
                      </div>
                      <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted">
                        {caseQuestion.type === 'clinic_mcq' ? 'QCM' : 'QROC'}
                      </div>
                    </div>
                    
                    <div className="text-sm mb-2">{caseQuestion.text}</div>
                    
                    {caseQuestion.media_url && (
                      <div className="mb-2 border rounded overflow-hidden">
                        {caseQuestion.media_type === 'image' ? (
                          <img 
                            src={caseQuestion.media_url} 
                            alt="Question media" 
                            className="w-full h-auto max-h-[150px] object-contain"
                          />
                        ) : caseQuestion.media_type === 'video' ? (
                          <video 
                            src={caseQuestion.media_url} 
                            controls 
                            className="w-full max-h-[150px]"
                          />
                        ) : null}
                      </div>
                    )}

                    {(caseQuestion.type === 'clinic_mcq') && caseQuestion.options && (
                      <div className="space-y-1">
                        {caseQuestion.options.map((option, optIndex) => (
                          <div key={option.id} className="border rounded-md p-2">
                            <div className="flex items-start gap-2">
                              <div className={`flex-shrink-0 h-4 w-4 rounded-full flex items-center justify-center text-xs 
                                ${(caseQuestion.correct_answers?.includes(option.id)) 
                                  ? 'bg-green-100 text-green-800 border border-green-300' 
                                  : 'bg-muted text-muted-foreground'}`}
                              >
                                {String.fromCharCode(65 + optIndex)}
                              </div>
                              <span className="flex-grow text-xs">{option.text}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Regular Question Content */}
        {!isClinicalCase && (
          <>
            {question.media_url && (
              <div className="mb-4 border rounded overflow-hidden">
                {question.media_type === 'image' ? (
                  <img 
                    src={question.media_url} 
                    alt="Question media" 
                    className="w-full h-auto max-h-[200px] object-contain"
                  />
                ) : question.media_type === 'video' ? (
                  <video 
                    src={question.media_url} 
                    controls 
                    className="w-full max-h-[200px]"
                  />
                ) : null}
              </div>
            )}
          
            {(question.type === 'mcq' || question.type === 'clinic_mcq') && question.options && (
              <div className="space-y-2">
                {question.options.map((option, index) => (
                  <div key={option.id} className="border rounded-md p-2">
                    <div className="flex items-start gap-2">
                      <div className={`flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center text-xs 
                        ${(question.correct_answers?.includes(option.id)) 
                          ? 'bg-green-100 text-green-800 border border-green-300' 
                          : 'bg-muted text-muted-foreground'}`}
                      >
                        {String.fromCharCode(65 + index)}
                      </div>
                      <span className="flex-grow">{option.text}</span>
                      
                      {option.explanation && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0"
                          onClick={() => toggleOption(option.id)}
                        >
                          {expandedOption === option.id ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </Button>
                      )}
                    </div>
                    
                    {expandedOption === option.id && option.explanation && (
                      <div className="mt-2 pt-2 pl-7 text-xs text-muted-foreground border-t">
                        {option.explanation}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {(question.course_reminder || question.explanation) && (
              <div className="mt-3 pt-3 border-t">
                <strong>Rappel du cours:</strong> {question.course_reminder || question.explanation}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
