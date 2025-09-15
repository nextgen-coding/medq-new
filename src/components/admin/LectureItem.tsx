import { Lecture } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Edit, Trash, FileText, PlusCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { EditLectureDialog } from '@/components/lectures/EditLectureDialog';
import { QuestionManagementDialog } from '@/components/questions/QuestionManagementDialog';
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
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface LectureItemProps {
  lecture: Lecture;
  onDelete: (id: string) => void;
  onUpdate?: () => void;
}

export function LectureItem({ lecture, onDelete, onUpdate }: LectureItemProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isQuestionsDialogOpen, setIsQuestionsDialogOpen] = useState(false);
  const { t } = useTranslation();
  
  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      
      // Check if lecture has questions associated with it
      const questionsResponse = await fetch(`/api/questions?lectureId=${lecture.id}`);
      if (!questionsResponse.ok) throw new Error('Failed to check questions');
      const questions = await questionsResponse.json();
      
      if (questions && questions.length > 0) {
        // First delete all the questions associated with this lecture
        for (const question of questions) {
          const deleteQuestionResponse = await fetch(`/api/questions/${question.id}`, {
            method: 'DELETE',
          });
          if (!deleteQuestionResponse.ok) {
            throw new Error('Failed to delete question');
          }
        }
      }
      
      // Delete the lecture
      const deleteResponse = await fetch(`/api/lectures/${lecture.id}`, {
        method: 'DELETE',
      });
      
      if (!deleteResponse.ok) {
        const errorData = await deleteResponse.json();
        throw new Error(errorData.error || 'Failed to delete lecture');
      }
      
      toast({
        title: t('lectures.deleteLecture'),
        description: t('admin.questionDeleted'),
      });
      
      onDelete(lecture.id);
    } catch (error) {
      console.error('Error deleting lecture:', error);
      toast({
        title: t('common.error'),
        description: t('common.tryAgain'),
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLectureUpdated = () => {
    console.log('handleLectureUpdated called');
    if (onUpdate) {
      console.log('Calling onUpdate...');
      onUpdate();
    }
  };
  
  
  return (
    <Card className="group relative overflow-hidden rounded-xl border border-border/60 bg-background/60 backdrop-blur hover:shadow-lg transition-all">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700" />
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 w-full pr-2">
            <CardTitle className="text-sm font-semibold leading-tight line-clamp-1">{lecture.title}</CardTitle>
            <CardDescription className="line-clamp-2 text-xs">{lecture.description || t('lectures.noDescription')}</CardDescription>
          </div>
          <div className="flex flex-col items-end gap-1">
            {lecture.isFree && (
              <span className="text-[10px] font-medium bg-green-100 text-green-700 px-2 py-1 rounded-full uppercase tracking-wide">Free</span>
            )}
            {lecture.specialty && (
              <span className="text-[10px] font-medium bg-secondary/50 text-secondary-foreground px-2 py-1 rounded-full uppercase tracking-wide">{lecture.specialty.name}</span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="flex items-center justify-end gap-2 border-t border-border/50 pt-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                className="h-8 w-8 rounded-lg hover:bg-primary/10"
                onClick={() => setIsEditDialogOpen(true)}
              >
                <Edit className="h-4 w-4" />
                <span className="sr-only">{t('common.edit')}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{t('common.edit')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                className="h-8 w-8 rounded-lg hover:bg-primary/10"
                onClick={() => setIsQuestionsDialogOpen(true)}
              >
                <FileText className="h-4 w-4" />
                <span className="sr-only">Questions</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Questions</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                className="h-8 w-8 rounded-lg hover:bg-primary/10"
                onClick={() => {
                  setIsQuestionsDialogOpen(true);
                  // Use a microtask to ensure dialog state propagates before opening nested create
                  queueMicrotask(() => {
                    try { window.dispatchEvent(new Event('qmd:close-children')); } catch {}
                    const ev = new CustomEvent('open-create-question', { detail: { lectureId: lecture.id } });
                    window.dispatchEvent(ev);
                  });
                }}
                title="Créer une question"
              >
                <PlusCircle className="h-4 w-4" />
                <span className="sr-only">Créer une question</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Créer une question</TooltipContent>
          </Tooltip>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10"
                    disabled={isDeleting}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Trash className="h-4 w-4" />
                    <span className="sr-only">{t('common.delete')}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">{t('common.delete')}</TooltipContent>
              </Tooltip>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('lectures.deleteLecture')}</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{lecture.title}"? This will also delete all associated questions. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction 
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={handleDelete}
                >
                  {t('common.delete')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>

      <EditLectureDialog
        lecture={lecture}
        isOpen={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onLectureUpdated={handleLectureUpdated}
      />

      <QuestionManagementDialog
        lecture={lecture}
        isOpen={isQuestionsDialogOpen}
        onOpenChange={setIsQuestionsDialogOpen}
      />
    </Card>
  );
}
