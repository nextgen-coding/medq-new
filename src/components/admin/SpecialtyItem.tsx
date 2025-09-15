import { Specialty } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Edit, Trash } from 'lucide-react';
import { useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { EditSpecialtyDialog } from '@/components/specialties/EditSpecialtyDialog';
import { getMedicalIcon } from '@/lib/medical-icons';
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

interface SpecialtyItemProps {
  specialty: Specialty;
  onDelete: (id: string) => void;
  onUpdate?: () => void;
}

export function SpecialtyItem({ specialty, onDelete, onUpdate }: SpecialtyItemProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  // Get the medical icon for this specialty
  const medicalIcon = getMedicalIcon(specialty.icon);
  const IconComponent = medicalIcon.icon;
  
  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      
      // Check if specialty has lectures associated with it
      const lecturesResponse = await fetch(`/api/lectures?specialtyId=${specialty.id}`);
      if (!lecturesResponse.ok) throw new Error('Failed to check lectures');
      const lectures = await lecturesResponse.json();
      
      if (lectures && lectures.length > 0) {
        toast({
          title: "Cannot delete specialty",
          description: "This specialty has lectures associated with it. Delete those first.",
          variant: "destructive",
        });
        return;
      }
      
      // Delete the specialty
      const deleteResponse = await fetch(`/api/specialties/${specialty.id}`, {
        method: 'DELETE',
      });
      
      if (!deleteResponse.ok) {
        const errorData = await deleteResponse.json();
        throw new Error(errorData.error || 'Failed to delete specialty');
      }
      
      toast({
        title: "Specialty deleted",
        description: "The specialty has been successfully removed",
      });
      
      onDelete(specialty.id);
    } catch (error) {
      console.error('Error deleting specialty:', error);
      toast({
        title: "Error",
        description: "Failed to delete specialty. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSpecialtyUpdated = () => {
    console.log('handleSpecialtyUpdated called'); // Debug log
    if (onUpdate) {
      console.log('Calling onUpdate...'); // Debug log
      onUpdate(); // This calls fetchSpecialties() in SpecialtiesTab
    }
  };
  
  return (
    <Card className="group relative overflow-hidden rounded-xl backdrop-blur-sm bg-white/80 dark:bg-gray-800/80 border-blue-200 dark:border-blue-800 shadow-lg hover:shadow-xl transition-all duration-300">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500" />
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            {/* Medical Icon */}
            <div className={`flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border border-blue-200 dark:border-blue-700 flex-shrink-0 ${medicalIcon.color} ${medicalIcon.darkColor}`}>
              <IconComponent className="w-6 h-6" />
            </div>
            <div className="space-y-1 min-w-0 flex-1">
              <CardTitle className="text-sm font-semibold leading-tight line-clamp-1 text-blue-700 dark:text-blue-300">{specialty.name}</CardTitle>
              <CardDescription className="line-clamp-2 text-xs">{specialty.description || 'No description available'}</CardDescription>
            </div>
          </div>
          {specialty.niveau && (
            <span className="flex-shrink-0 text-[10px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full uppercase tracking-wide">
              {specialty.niveau.name}
            </span>
          )}
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
                <span className="sr-only">Edit specialty</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Edit</TooltipContent>
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
                    <span className="sr-only">Delete specialty</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Delete</TooltipContent>
              </Tooltip>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Specialty</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{specialty.name}"? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={handleDelete}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>

      <EditSpecialtyDialog
        specialty={specialty}
        isOpen={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSpecialtyUpdated={handleSpecialtyUpdated}
      />
    </Card>
  );
}
