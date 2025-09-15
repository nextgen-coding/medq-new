import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export function useProgress() {
  const { user } = useAuth();

  const trackQuestionProgress = useCallback((
    lectureId: string,
    questionId: string,
    result: boolean | 'partial',
    score?: number // optional explicit numeric score (0..1). If provided it always wins.
  ) => {
    if (!user?.id) return;

    // Determine numeric score (allow fine‑grained partial credit)
    let numericScore: number;
    if (typeof score === 'number' && !Number.isNaN(score)) {
      numericScore = Math.min(1, Math.max(0, score));
    } else if (result === true) {
      numericScore = 1;
    } else if (result === 'partial') {
      numericScore = 0.5; // legacy fallback when caller doesn't supply a fractional score
    } else {
      numericScore = 0;
    }

    fetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lectureId,
        questionId,
        completed: true,
        score: numericScore,
        userId: user.id
      })
    }).catch(error => console.error('Error tracking progress:', error));
  }, [user]);

  const trackLectureProgress = useCallback((
    lectureId: string,
    completed: boolean = true
  ) => {
    if (!user?.id) return;

    // Fire and forget - don't block the UI
    fetch('/api/progress', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        lectureId,
        completed,
        userId: user.id
      }),
    }).catch(error => {
      console.error('Error tracking lecture progress:', error);
    });
  }, [user]);

  const getProgress = useCallback(async (lectureId?: string, specialtyId?: string) => {
    if (!user?.id) return null;

    try {
      const params = new URLSearchParams();
      if (lectureId) params.append('lectureId', lectureId);
      if (specialtyId) params.append('specialtyId', specialtyId);
      params.append('userId', user.id);

      const response = await fetch(`/api/progress?${params.toString()}`);
      if (response.ok) {
        const progressData = await response.json();
        
        // Convert numeric scores back to boolean/partial format
        return progressData.map((item: any) => ({
          ...item,
            // Treat any 0 < score < 1 as partial for status display
          result: item.score === 1 ? true : (item.score > 0 ? 'partial' : false)
        }));
      }
    } catch (error) {
      console.error('Error fetching progress:', error);
    }
    return null;
  }, [user]);

  // Helper function to convert numeric score to result format
  const convertScoreToResult = useCallback((score: number | null): boolean | 'partial' | false => {
    if (score === null || score === undefined) return false;
    if (score >= 1) return true;
    if (score > 0) return 'partial';
    return false;
  }, []);

  return {
    trackQuestionProgress,
    trackLectureProgress,
    getProgress,
    convertScoreToResult
  };
} 