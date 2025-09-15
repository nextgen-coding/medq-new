'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlusCircle, Edit, Trash, Search, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Question, Lecture } from '@/types';
import { toast } from '@/hooks/use-toast';
import { CreateQuestionDialog } from './CreateQuestionDialog';
import { QuestionOrganizerDialog } from './QuestionOrganizerDialog';
import { QuestionEditDialog } from './QuestionEditDialog';
import { useAuth } from '@/contexts/AuthContext';
import { RichTextDisplay, extractPlainText } from '@/components/ui/rich-text-display';
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

interface QuestionManagementDialogProps {
  lecture: Lecture;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialCreateOpen?: boolean; // when opening dialog, also open create modal
  initialOrganizerOpen?: boolean; // when opening dialog, open organizer directly
}

export function QuestionManagementDialog({ lecture, isOpen, onOpenChange, initialCreateOpen = false, initialOrganizerOpen = false }: QuestionManagementDialogProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isMaintainer = user?.role === 'maintainer';
  const [questions, setQuestions] = useState<Question[]>([]);
  const [filteredQuestions, setFilteredQuestions] = useState<Question[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isOrganizerOpen, setIsOrganizerOpen] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [shouldOpenCreate, setShouldOpenCreate] = useState(false);
  // Track how the dialog was opened to avoid unwanted cascades
  const [openContext, setOpenContext] = useState<'normal' | 'standaloneCreate' | 'standaloneOrganizer'>('normal');
  // If a child dialog was opened from the parent, we will re-open the parent after it closes
  const [reopenParentAfterChild, setReopenParentAfterChild] = useState(false);
  // Ensure initial flags are consumed once per parent open
  const [consumedInitialCreate, setConsumedInitialCreate] = useState(false);
  const [consumedInitialOrganizer, setConsumedInitialOrganizer] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchQuestions();
      setSearchQuery('');
      // Standalone open: immediately close the parent to avoid stacked modals
      if ((initialCreateOpen && !consumedInitialCreate) || shouldOpenCreate) {
  // Ensure other children are closed
  setIsOrganizerOpen(false);
  setIsEditDialogOpen(false);
        setIsCreateDialogOpen(true);
        setOpenContext('standaloneCreate');
        setShouldOpenCreate(false);
        setConsumedInitialCreate(true);
        setReopenParentAfterChild(false);
        // Close the parent right away to prevent background modal
        onOpenChange(false);
      }
      if (initialOrganizerOpen && !consumedInitialOrganizer) {
  // Ensure other children are closed
  setIsCreateDialogOpen(false);
  setIsEditDialogOpen(false);
        setIsOrganizerOpen(true);
        setOpenContext('standaloneOrganizer');
        setConsumedInitialOrganizer(true);
        setReopenParentAfterChild(false);
        onOpenChange(false);
      }
    } else {
      // Reset consumption flags when parent fully closes
      setConsumedInitialCreate(false);
      setConsumedInitialOrganizer(false);
      setOpenContext('normal');
    }
  }, [isOpen, lecture.id, initialCreateOpen, initialOrganizerOpen, consumedInitialCreate, consumedInitialOrganizer, shouldOpenCreate, onOpenChange]);

  // Listen to global event from LectureItem's quick-create button
  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<{ lectureId: string }>;
      if (custom?.detail?.lectureId === lecture.id) {
        // open parent dialog first if not open
        if (!isOpen) onOpenChange(true);
        // ask other instances to close their children
        try { window.dispatchEvent(new Event('qmd:close-children')); } catch {}
        setShouldOpenCreate(true);
      }
    };
    window.addEventListener('open-create-question', handler as EventListener);
    return () => window.removeEventListener('open-create-question', handler as EventListener);
  }, [lecture.id, isOpen, onOpenChange]);

  // Global: close child dialogs if requested by another instance
  useEffect(() => {
    const closeChildren = () => {
      setIsCreateDialogOpen(false);
      setIsOrganizerOpen(false);
      setIsEditDialogOpen(false);
    };
    window.addEventListener('qmd:close-children', closeChildren);
    return () => window.removeEventListener('qmd:close-children', closeChildren);
  }, []);

  // Filter questions based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredQuestions(questions);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = questions.filter(question => 
        extractPlainText(question?.text || '').toLowerCase().includes(query) ||
        question?.type?.toLowerCase().includes(query) ||
        extractPlainText(question?.explanation || '').toLowerCase().includes(query) ||
        question?.options?.some(option => extractPlainText(option?.text || '').toLowerCase().includes(query))
      );
      setFilteredQuestions(filtered);
    }
  }, [questions, searchQuery]);

  const fetchQuestions = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/questions?lectureId=${lecture.id}`);
      if (response.ok) {
        const data = await response.json();
        setQuestions(data);
        setFilteredQuestions(data);
      } else {
        throw new Error('Failed to fetch questions');
      }
    } catch (error) {
      console.error('Error fetching questions:', error);
      toast({
        title: "Error",
        description: "Failed to load questions. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    try {
      const response = await fetch(`/api/questions/${questionId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setQuestions(prev => prev.filter(q => q.id !== questionId));
        toast({
          title: "Question deleted",
          description: "The question has been successfully removed",
        });
      } else {
        throw new Error('Failed to delete question');
      }
    } catch (error) {
      console.error('Error deleting question:', error);
      toast({
        title: "Error",
        description: "Failed to delete question. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleQuestionCreated = () => {
    fetchQuestions();
    setIsCreateDialogOpen(false);
    setSearchQuery(''); // Clear search when new question is added
    // If opened as standalone create, close parent after create flow ends
    if (openContext === 'standaloneCreate') {
      onOpenChange(false);
      setOpenContext('normal');
    }
  };

  const handleQuestionUpdated = () => {
    fetchQuestions();
    setIsEditDialogOpen(false);
    setSelectedQuestion(null);
  };

  const handleEditQuestion = (question: Question) => {
    setSelectedQuestion(question);
    setIsEditDialogOpen(true);
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden flex flex-col p-0 border-blue-200/60 dark:border-blue-900/40">
        <DialogHeader className="flex-shrink-0 p-6 pb-4 border-b border-blue-100/80 dark:border-blue-900/40 bg-gradient-to-b from-blue-50/60 to-transparent dark:from-blue-950/30">
          <DialogTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
            Questions pour « {lecture.title} »
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex justify-between items-center flex-shrink-0 px-6 pb-4 space-x-4">
          <p className="text-sm text-muted-foreground">
            {searchQuery ? (
              <>
                {filteredQuestions.length} sur {questions.length} question{questions.length !== 1 ? 's' : ''}
                {filteredQuestions.length === 0 ? ' trouvée' : ' correspondant à la recherche'}
              </>
            ) : (
              <>
                {questions.length} question{questions.length !== 1 ? 's' : ''} au total
              </>
            )}
          </p>
          
          <div className="flex items-center space-x-2">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher des questions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10 w-64"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSearch}
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-muted"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            
            {/* Add Question Button */}
      <Button
              onClick={() => {
                // Open child and close parent to avoid stacked dialogs
                setOpenContext('normal');
        // close any child dialogs in other instances
        try { window.dispatchEvent(new Event('qmd:close-children')); } catch {}
                // Close other child dialogs to avoid background overlays
                setIsOrganizerOpen(false);
                setIsEditDialogOpen(false);
                setIsCreateDialogOpen(true);
                setReopenParentAfterChild(true);
                onOpenChange(false);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              Créer une question
            </Button>
            {/* Organizer */}
            {isAdmin && (
        <Button
                variant="outline"
                onClick={() => {
                  // Open child and close parent to avoid stacked dialogs
                  setOpenContext('normal');
          // close any child dialogs in other instances
          try { window.dispatchEvent(new Event('qmd:close-children')); } catch {}
                  // Close other child dialogs to avoid background overlays
                  setIsCreateDialogOpen(false);
                  setIsEditDialogOpen(false);
                  setIsOrganizerOpen(true);
                  setReopenParentAfterChild(true);
                  onOpenChange(false);
                }}
                className="border-blue-200 dark:border-blue-800"
              >
                Organiser
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4 min-h-0" style={{ maxHeight: 'calc(95vh - 220px)' }}>
          {isLoading ? (
            Array(3).fill(0).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="animate-pulse space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4"></div>
                    <div className="h-3 bg-muted rounded w-1/2"></div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : filteredQuestions.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">
                  {searchQuery ? 
                    `Aucune question ne correspond à "${searchQuery}".` : 
                    'Aucune question trouvée pour ce cours.'
                  }
                </p>
                {searchQuery && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearSearch}
                    className="mt-2"
                  >
                    Effacer la recherche
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            filteredQuestions.map((question, index) => {
              // Calculate the original index from the full questions array
              const originalIndex = questions.findIndex(q => q.id === question.id);
              return (
              <Card 
                key={question.id}
                className="transition hover:ring-1 hover:ring-blue-200 dark:hover:ring-blue-800 cursor-pointer"
                onClick={() => handleEditQuestion(question)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-sm font-medium line-clamp-3">
                        <span className="text-xs text-muted-foreground mr-2">#{originalIndex + 1}</span>
                        {/* Highlight search terms */}
                        {searchQuery && question?.text ? (
                          <span dangerouslySetInnerHTML={{
                            __html: extractPlainText(question.text).replace(
                              new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
                              '<mark class="bg-yellow-200 px-1 rounded">$1</mark>'
                            )
                          }} />
                        ) : (
                          <RichTextDisplay text={question?.text || ''} />
                        )}
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
            Type : <span className="font-medium">{question.type.toUpperCase()}</span>
                        {question.options && (
                          <span className="ml-2">
              | Options : <span className="font-medium">{question.options.length}</span>
                          </span>
                        )}
                        {question.correctAnswers?.length && (
                          <span className="ml-2">
              | Correctes : <span className="font-medium">{question.correctAnswers.length}</span>
                          </span>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex space-x-1 ml-4 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleEditQuestion(question)}
                        className="border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      
                      {isAdmin && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                            >
                              <Trash className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer la question</AlertDialogTitle>
                              <AlertDialogDescription>
                                Êtes-vous sûr de vouloir supprimer cette question ? Cette action est définitive.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction 
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => handleDeleteQuestion(question.id)}
                              >
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                </CardHeader>
                {(question.explanation || (question.options && question.options.length > 0)) && (
                  <CardContent className="pt-2">
                    {question.options && question.options.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Options :</p>
                        <div className="space-y-1">
                          {question.options.map((option, optIndex) => (
                            <div key={option?.id || `option-${question.id}-${optIndex}`} className="flex items-center text-xs">
                              <span className="mr-2 font-mono text-muted-foreground">
                                {String.fromCharCode(65 + optIndex)}.
                              </span>
                              <span className={`flex-1 ${
                                (question.correctAnswers || question.correct_answers || []).includes(option?.id)
                                  ? 'font-medium text-green-700 bg-green-50 px-2 py-1 rounded'
                                  : ''
                              }`}>
                                {/* Highlight search terms in options */}
                                {searchQuery && option?.text ? (
                                  <span dangerouslySetInnerHTML={{
                                    __html: option.text.replace(
                                      new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
                                      '<mark class="bg-yellow-200 px-1 rounded">$1</mark>'
                                    )
                                  }} />
                                ) : (
                                  option?.text || ''
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
          {question.explanation && (
                      <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Explication :</p>
                        <p className="text-xs text-muted-foreground line-clamp-3">
                          {/* Highlight search terms in explanation */}
                          {searchQuery && question?.explanation ? (
                            <span dangerouslySetInnerHTML={{
                              __html: question.explanation.replace(
                                new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
                                '<mark class="bg-yellow-200 px-1 rounded">$1</mark>'
                              )
                            }} />
                          ) : (
                            question?.explanation || ''
                          )}
                        </p>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            )})
          )}
        </div>
      </DialogContent>
    </Dialog>
    {/* Child dialogs rendered outside parent to avoid stacking/unmount issues */}
    <CreateQuestionDialog
      lecture={lecture}
      isOpen={isCreateDialogOpen}
      onOpenChange={(open) => {
        setIsCreateDialogOpen(open);
        if (!open) {
          // When child closes, optionally reopen the parent if it was the source
          if (reopenParentAfterChild) {
            setTimeout(() => onOpenChange(true), 0);
            setReopenParentAfterChild(false);
          }
          // If opened as standalone, keep parent closed
          if (openContext === 'standaloneCreate') {
            setOpenContext('normal');
          }
        }
      }}
      onQuestionCreated={handleQuestionCreated}
    />

    <QuestionEditDialog
      question={selectedQuestion}
      isOpen={isEditDialogOpen}
      onOpenChange={setIsEditDialogOpen}
      onQuestionUpdated={handleQuestionUpdated}
    />

    <QuestionOrganizerDialog
      lecture={lecture}
      isOpen={isOrganizerOpen}
      onOpenChange={(open) => {
        setIsOrganizerOpen(open);
        if (!open) {
          if (reopenParentAfterChild) {
            setTimeout(() => onOpenChange(true), 0);
            setReopenParentAfterChild(false);
          }
          if (openContext === 'standaloneOrganizer') {
            setOpenContext('normal');
          } else {
            fetchQuestions();
          }
        }
      }}
      onSaved={() => fetchQuestions()}
    />
    </>
  );
}
