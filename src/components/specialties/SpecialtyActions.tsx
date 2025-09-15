import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Specialty } from '@/types';
import { Edit, Trash2, Plus, BookOpen } from 'lucide-react';
import { AddLectureDialog } from './AddLectureDialog';
import { AddQuestionDialog } from './AddQuestionDialog';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

interface SpecialtyActionsProps {
  specialty: Specialty;
  onEdit: () => void;
  onDelete: () => void;
  onLectureAdded?: () => void;
  onQuestionAdded?: () => void;
}

export function SpecialtyActions({ 
  specialty, 
  onEdit, 
  onDelete, 
  onLectureAdded,
  onQuestionAdded 
}: SpecialtyActionsProps) {
  const { isAdmin, user } = useAuth();
  const [showAddLecture, setShowAddLecture] = useState(false);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const { t } = useTranslation();

  const handleDelete = async () => {
    if (!confirm(t('specialties.confirmDelete'))) {
      return;
    }

    try {
      const response = await fetch(`/api/specialties/${specialty.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete specialty');
      }

      onDelete();
      toast({
        title: t('common.success'),
        description: t('specialties.deletedSuccessfully'),
      });
    } catch (error) {
      console.error('Error deleting specialty:', error);
      toast({
        title: t('common.error'),
        description: t('common.tryAgain'),
        variant: "destructive",
      });
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAddLecture(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          {t('lectures.addLecture')}
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAddQuestion(true)}
          className="flex items-center gap-2"
        >
          <BookOpen className="h-4 w-4" />
          {t('questions.addQuestion')}
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={onEdit}
          className="flex items-center gap-2"
        >
          <Edit className="h-4 w-4" />
          {t('common.edit')}
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleDelete}
          className="flex items-center gap-2 text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
          {t('common.delete')}
        </Button>
      </div>

      <AddLectureDialog
        specialtyId={specialty.id}
        isOpen={showAddLecture}
        onOpenChange={setShowAddLecture}
        onLectureAdded={() => {
          setShowAddLecture(false);
          onLectureAdded?.();
        }}
      />

      <AddQuestionDialog
        isOpen={showAddQuestion}
        onOpenChange={setShowAddQuestion}
        selectedLectureId={null}
        setSelectedLectureId={() => {}}
        lectures={[]}
      />
    </>
  );
}
