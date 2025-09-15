'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Question } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pin, PinOff, Play, BookOpen } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';

interface PinnedQuestion {
  id: string;
  questionId: string;
  userId: string;
  createdAt: string;
  question: {
    id: string;
    text: string;
    type: string;
    number?: number;
    session?: string;
  };
}

export default function PinnedQuestionsPage() {
  const { user } = useAuth();
  // const { t } = useTranslation();
  const [pinnedQuestions, setPinnedQuestions] = useState<PinnedQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadPinnedQuestions = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }
      
      try {
        const response = await fetch(`/api/pinned-questions?userId=${user.id}`);
        if (response.ok) {
          const data = await response.json();
          setPinnedQuestions(data);
        } else {
          toast({
            title: "Error",
            description: "Failed to load pinned questions.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Error loading pinned questions:', error);
        toast({
          title: "Error",
          description: "Failed to load pinned questions.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadPinnedQuestions();
  }, [user?.id]);

  const handleUnpinQuestion = async (questionId: string) => {
    if (!user?.id) return;
    
    try {
      const response = await fetch(`/api/pinned-questions?userId=${user.id}&questionId=${questionId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setPinnedQuestions(prev => prev.filter(pq => pq.questionId !== questionId));
        toast({
          title: "Question Unpinned",
          description: "Question has been removed from your pinned collection.",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to unpin question.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error unpinning question:', error);
      toast({
        title: "Error",
        description: "Failed to unpin question.",
        variant: "destructive",
      });
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'mcq': return 'QCM';
      case 'qroc': return 'QROC';
      case 'open': return 'QROC';
      case 'clinic_mcq': return 'QCM Clinique';
      case 'clinic_croq': return 'QROC Clinique';
      default: return type.toUpperCase();
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'mcq': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'qroc': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
  case 'open': return 'bg-medblue-100 text-medblue-800 dark:bg-medblue-900 dark:text-medblue-200';
      case 'clinic_mcq': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'clinic_croq': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <h1 className="text-2xl font-bold mb-4">Please Sign In</h1>
            <p className="text-muted-foreground">You need to be signed in to view your pinned questions.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Pin className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold">Pinned Questions</h1>
        </div>
        <p className="text-muted-foreground">
          Questions you&apos;ve pinned for quick access and review.
        </p>
      </div>

      {pinnedQuestions.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Pin className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Pinned Questions</h2>
            <p className="text-muted-foreground mb-6">
              You haven&apos;t pinned any questions yet. Pin questions while studying to quickly access them later.
            </p>
            <Link href="/matieres">
              <Button>
                <BookOpen className="h-4 w-4 mr-2" />
                Browse Exercises
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {pinnedQuestions.map((pinnedQuestion) => (
            <Card key={pinnedQuestion.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge className={getTypeColor(pinnedQuestion.question.type)}>
                        {getTypeLabel(pinnedQuestion.question.type)}
                      </Badge>
                      {pinnedQuestion.question.number && (
                        <Badge variant="outline">
                          #{pinnedQuestion.question.number}
                        </Badge>
                      )}
                      {pinnedQuestion.question.session && (
                        <Badge variant="secondary">
                          {pinnedQuestion.question.session}
                        </Badge>
                      )}
                    </div>
                    
                    <h3 className="font-medium text-foreground mb-2 line-clamp-2">
                      {pinnedQuestion.question.text}
                    </h3>
                    
                    <p className="text-sm text-muted-foreground">
                      Pinned on {new Date(pinnedQuestion.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUnpinQuestion(pinnedQuestion.questionId)}
                      className="flex items-center gap-1"
                    >
                      <PinOff className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Unpin</span>
                    </Button>
                    
                    <Button
                      size="sm"
                      className="flex items-center gap-1"
                      asChild
                    >
                      <Link href={`/lecture/${pinnedQuestion.questionId}`}>
                        <Play className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Practice</span>
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
