"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/hooks/use-toast';
import { Lecture, Question, ClinicalCase } from '@/types';
import { useLocalStorage } from './use-local-storage';
import { useAuth } from '@/contexts/AuthContext';
import { useProgress } from './use-progress';

// Cache for lecture data to avoid refetching
const lectureCache = new Map<string, { lecture: Lecture; questions: Question[]; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useLecture(lectureId: string | undefined, mode?: string | null) {
  const router = useRouter();
  const { user } = useAuth();
  const { trackQuestionProgress, trackLectureProgress } = useProgress();
  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [pinnedQuestionIds, setPinnedQuestionIds] = useState<string[]>([]);
  
  const storageKey = `lecture-${lectureId}${mode ? `-${mode}` : ''}`;
  const [currentQuestionIndex, setCurrentQuestionIndex] = useLocalStorage<number>(`${storageKey}-currentIndex`, 0);
  const [answers, setAnswers] = useLocalStorage<Record<string, any>>(`${storageKey}-answers`, {});
  const [answerResults, setAnswerResults] = useLocalStorage<Record<string, boolean | 'partial'>>(`${storageKey}-results`, {});
  const [isComplete, setIsComplete] = useLocalStorage<boolean>(`${storageKey}-complete`, false);
  

  
  const [isLoading, setIsLoading] = useState(true);
  const [isAddQuestionOpen, setIsAddQuestionOpen] = useState(false);
  const hasSyncedProgress = useRef(false);

  // Create filtered questions based on mode
  const questions = useMemo(() => {
    if (mode === 'pinned') {
      return allQuestions.filter(q => pinnedQuestionIds.includes(q.id));
    }
    return allQuestions;
  }, [allQuestions, pinnedQuestionIds, mode]);

  // Group clinical case questions and organize all questions properly
  const groupedQuestions = useMemo(() => {
    if (!questions || questions.length === 0) {
      console.log('No questions available, returning empty array');
      return [];
    }
    
  const mcqQuestions: Question[] = [];
  const qrocQuestions: Question[] = [];
  // Multi QROC grouping map (caseNumber -> questions)
  const multiQrocMap = new Map<number, Question[]>();
  const clinicalCaseMap = new Map<number, Question[]>();
  const textCaseMap = new Map<string, number>(); // map caseText -> synthetic caseNumber
  let nextSyntheticCase = 100000; // large range to avoid collisions with real numbers

    // Separate questions by type
    questions.forEach(question => {
      if ((question.type === 'clinic_mcq' || question.type === 'clinic_croq')) {
        // Prefer explicit caseNumber; else group by identical caseText
        let keyNum: number | undefined = question.caseNumber || undefined;
        if (!keyNum) {
          const text = (question.caseText || '').trim();
          if (text) {
            if (!textCaseMap.has(text)) {
              textCaseMap.set(text, nextSyntheticCase++);
            }
            keyNum = textCaseMap.get(text)!;
          }
        }
        if (keyNum) {
          if (!clinicalCaseMap.has(keyNum)) clinicalCaseMap.set(keyNum, []);
          clinicalCaseMap.get(keyNum)!.push(question);
          return;
        }
        // If still no key (no number and no text), fall back to type bucket below
      }
      if (question.type === 'mcq') {
        mcqQuestions.push(question);
      } else if (question.type === 'qroc' && question.caseNumber) {
        if (!multiQrocMap.has(question.caseNumber)) multiQrocMap.set(question.caseNumber, []);
        multiQrocMap.get(question.caseNumber)!.push(question);
      } else {
        qrocQuestions.push(question);
      }
    });

    // Promote multi QROC groups (only groups with >1)
    const multiQrocCases: ClinicalCase[] = [];
    multiQrocMap.forEach((list, num) => {
      if (list.length > 1) {
        list.sort((a,b)=> (a.caseQuestionNumber||0)-(b.caseQuestionNumber||0));
        multiQrocCases.push({
          caseNumber: num,
          caseText: '',
          questions: list,
          totalQuestions: list.length
        });
      } else {
        // single item fallback to normal bucket
        qrocQuestions.push(list[0]);
      }
    });

    // Sort each group by their number
    mcqQuestions.sort((a, b) => (a.number || 0) - (b.number || 0));
    qrocQuestions.sort((a, b) => (a.number || 0) - (b.number || 0));
    multiQrocCases.sort((a,b)=> a.caseNumber - b.caseNumber);

    // Convert clinical case groups to ClinicalCase objects and sort by case number
  const clinicalCases: ClinicalCase[] = [];
  Array.from(clinicalCaseMap.entries())
      .sort(([a], [b]) => a - b) // Sort by case number
      .forEach(([caseNumber, caseQuestions]) => {
        // Sort questions within each case by caseQuestionNumber
        const sortedQuestions = caseQuestions.sort((a, b) => 
          (a.caseQuestionNumber || 0) - (b.caseQuestionNumber || 0)
        );
        
        const clinicalCase: ClinicalCase = {
          caseNumber,
      caseText: (sortedQuestions[0]?.caseText || '').trim(),
          questions: sortedQuestions,
          totalQuestions: sortedQuestions.length
        };

        clinicalCases.push(clinicalCase);
      });

    // Combine all questions in the correct order: MCQ -> QROC -> Clinical Cases
    const result: (Question | ClinicalCase)[] = [
      ...mcqQuestions,
      ...qrocQuestions,
      ...multiQrocCases,
      ...clinicalCases
    ];

    console.log('Grouped questions result:', {
      totalQuestions: questions.length,
      totalGroupedItems: result.length,
      mcqCount: mcqQuestions.length,
      qrocCount: qrocQuestions.length,
  clinicalCasesCount: clinicalCases.length,
  multiQrocGroups: multiQrocCases.length
    });

    return result;
  }, [questions]);

  const fetchLectureData = useCallback(async () => {
    if (!lectureId) return;
    
    // Check cache first
    const cached = lectureCache.get(lectureId);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setLecture(cached.lecture);
      setAllQuestions(cached.questions);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Single optimized API call to fetch lecture with questions
      const response = await fetch(`/api/lectures/${lectureId}?includeQuestions=true`);
      if (!response.ok) {
        let serverMsg: string | undefined;
        try {
          const errJson = await response.json();
          serverMsg = errJson?.error || errJson?.message;
        } catch {}
        console.error('Failed lecture fetch', { lectureId, status: response.status, serverMsg });
        toast({
          title: 'Lecture load failed',
          description: serverMsg || `Request failed with status ${response.status}`,
          variant: 'destructive'
        });
        // Redirect only on 404 (not found / access) or 401
        if (response.status === 404 || response.status === 401) {
          router.push('/matieres');
        }
        setIsLoading(false);
        return;
      }

      const data = await response.json();
      
      console.log('Raw API response data:', {
        lectureId,
        hasLecture: !!data,
        lectureTitle: data?.title,
        questionsCount: data?.questions?.length || 0,
        rawQuestions: data?.questions,
        firstQuestionStructure: data?.questions?.[0]
      });
      
      // Cache the data
      lectureCache.set(lectureId, {
        lecture: data,
        questions: data.questions || [],
        timestamp: Date.now()
      });
      
      setLecture(data);
      setAllQuestions(data.questions || []);
      
      // Reset to first question if current index is out of bounds
      if (data.questions && data.questions.length > 0 && currentQuestionIndex >= data.questions.length) {
        setCurrentQuestionIndex(0);
      }
    } catch (error) {
      console.error('Error fetching lecture data:', error);
      toast({
        title: "Error",
        description: "Failed to load lecture information. Please try again.",
        variant: "destructive",
      });
      router.push('/dashboard');
    } finally {
      setIsLoading(false);
    }
  }, [lectureId, router]);

  useEffect(() => {
    fetchLectureData();
    // Reset sync flag when lecture changes
    hasSyncedProgress.current = false;
  }, [fetchLectureData]);

  // Prefill answers/results automatically for revision mode (single run)
  const revisionPrefilledRef = useRef(false);
  useEffect(() => {
    if (mode === 'revision' && !revisionPrefilledRef.current) {
      // Only prefill once when questions are loaded AND no existing answers
      if (allQuestions.length > 0 && Object.keys(answers).length === 0) {
        const prefillAnswers: Record<string, any> = {};
        const prefillResults: Record<string, boolean | 'partial'> = {};
        for (const q of allQuestions) {
          // MCQ & clinical MCQ: array of correct option ids
          if (q.type === 'mcq' || q.type === 'clinic_mcq') {
            const correct = (q.correct_answers || q.correctAnswers || []) as string[];
            prefillAnswers[q.id] = correct;
            prefillResults[q.id] = true;
          } else {
            // Open/QROC/clinical CROQ: use reference textual answer if available
            const ref = (
              (Array.isArray((q as any).correctAnswers) && (q as any).correctAnswers.length > 0 && (q as any).correctAnswers.filter(Boolean).join(' / ')) ||
              (Array.isArray((q as any).correct_answers) && (q as any).correct_answers.length > 0 && (q as any).correct_answers.filter(Boolean).join(' / ')) ||
              (q as any).course_reminder ||
              (q as any).courseReminder ||
              (q as any).explanation ||
              ''
            );
            prefillAnswers[q.id] = ref;
            prefillResults[q.id] = true;
          }
        }
        setAnswers(prefillAnswers);
        setAnswerResults(prefillResults);
        revisionPrefilledRef.current = true;
      }
    }
  }, [mode, allQuestions, answers, setAnswers, setAnswerResults]);

  // Load pinned questions (needed to show pin icon in navigation regardless of mode)
  useEffect(() => {
    const loadPinnedQuestions = async () => {
      if (user?.id) {
        try {
          const response = await fetch(`/api/pinned-questions?userId=${user.id}`);
          if (response.ok) {
            const pinnedQuestions = await response.json();
            const questionIds = pinnedQuestions.map((pq: any) => pq.questionId);
            setPinnedQuestionIds(questionIds);
          }
        } catch (error) {
          console.error('Error loading pinned questions:', error);
        }
      }
    };

    loadPinnedQuestions();
  }, [mode, user?.id]);

  // Listen for global pinned updates dispatched by question components
  useEffect(() => {
    const handler = () => {
      if (!user?.id) return;
      fetch(`/api/pinned-questions?userId=${user.id}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data) {
            setPinnedQuestionIds(data.map((pq: any) => pq.questionId));
          }
        })
        .catch(()=>{});
    };
    window.addEventListener('pinned-updated', handler);
    return () => window.removeEventListener('pinned-updated', handler);
  }, [user?.id]);

  // Clear cache when adding questions
  useEffect(() => {
    if (isAddQuestionOpen) {
      lectureCache.delete(lectureId!);
    }
  }, [isAddQuestionOpen, lectureId]);

  const handleAnswerSubmit = useCallback((questionId: string, answer: any, isCorrect?: boolean | 'partial') => {
    setAnswers((prevAnswers: Record<string, any>) => ({
      ...prevAnswers,
      [questionId]: answer
    }));
    
    if (isCorrect !== undefined) {
      setAnswerResults((prevResults: Record<string, boolean | 'partial'>) => ({
        ...prevResults,
        [questionId]: isCorrect
      }));
      
      // Track progress in database
      if (lectureId) {
        trackQuestionProgress(lectureId, questionId, isCorrect);
      }
    }
  }, [lectureId, trackQuestionProgress]);

  // Handle clinical case submission
  const handleClinicalCaseSubmit = useCallback((caseNumber: number, caseAnswers: Record<string, any>, caseResults: Record<string, boolean | 'partial'>) => {
    // Store all answers for the clinical case
    setAnswers((prevAnswers: Record<string, any>) => ({
      ...prevAnswers,
      ...caseAnswers
    }));
    
    // Store all results for the clinical case
    setAnswerResults((prevResults: Record<string, boolean | 'partial'>) => ({
      ...prevResults,
      ...caseResults
    }));
    
    // Track progress for each question in the clinical case
    if (lectureId) {
      Object.entries(caseResults).forEach(([questionId, result]) => {
        trackQuestionProgress(lectureId, questionId, result);
      });
    }
  }, [lectureId, trackQuestionProgress]);

  const handleNext = useCallback(() => {
    if (currentQuestionIndex < groupedQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      setIsComplete(true);
      
      // Track lecture completion in database
      if (lectureId) {
        trackLectureProgress(lectureId, true);
      }
    }
  }, [currentQuestionIndex, groupedQuestions.length, setCurrentQuestionIndex, lectureId, trackLectureProgress]);

  const handleRestart = useCallback(() => {
    setCurrentQuestionIndex(0);
    setAnswers({});
    setAnswerResults({});
    setIsComplete(false);
    hasSyncedProgress.current = false; // Reset sync flag for restart
  }, [setCurrentQuestionIndex]);

  const handleBackToSpecialty = useCallback(() => {
    if (lecture && lecture.specialtyId) {
      router.push(`/matieres/${lecture.specialtyId}`);
    } else {
      router.push('/matieres');
    }
  }, [lecture, router]);

  const clearSessionData = useCallback(() => {
    setCurrentQuestionIndex(0);
    setAnswers({});
    setAnswerResults({});
    setIsComplete(false);
  }, [setCurrentQuestionIndex]);

  const handleQuestionUpdate = useCallback((questionId: string, updates: Partial<Question>) => {
    setAllQuestions(prev => prev.map(q => 
      q.id === questionId ? { ...q, ...updates } : q
    ));
  }, []);

  const currentQuestion = useMemo(() => {
    const question = groupedQuestions[currentQuestionIndex];
    console.log('Current question:', {
      currentQuestionIndex,
      hasQuestion: !!question,
      questionType: question ? ('type' in question ? question.type : 'clinical') : 'unknown'
    });
    return question;
  }, [groupedQuestions, currentQuestionIndex]);
  
  const progress = useMemo(() => {
    // Calculate total number of individual questions (including those in clinical cases)
    let totalQuestions = 0;
    groupedQuestions.forEach(item => {
      if ('questions' in item && Array.isArray(item.questions)) {
        // Clinical case - count all questions within it
        totalQuestions += item.questions.length;
      } else {
        // Regular question
        totalQuestions += 1;
      }
    });

    if (totalQuestions === 0) return 0;
    const answeredCount = Object.keys(answers).length;
    return (answeredCount / totalQuestions) * 100;
  }, [groupedQuestions, answers]);

  return {
    lecture,
    questions: groupedQuestions, // Return grouped questions instead of raw questions
    currentQuestionIndex,
    setCurrentQuestionIndex,
    answers,
    answerResults,
    isLoading,
    isComplete,
    isAddQuestionOpen,
    setIsAddQuestionOpen,
    currentQuestion,
    progress,
    handleAnswerSubmit,
    handleClinicalCaseSubmit, // New handler for clinical cases
    handleNext,
    handleRestart,
    handleBackToSpecialty,
    clearSessionData,
    handleQuestionUpdate,
  refetch: fetchLectureData,
  pinnedQuestionIds
  };
}
