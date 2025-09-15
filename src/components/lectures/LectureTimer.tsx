
import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { useVisibility } from '@/hooks/use-visibility';
import { useLocalStorage } from '@/hooks/use-local-storage';

interface LectureTimerProps {
  lectureId: string;
}

export function LectureTimer({ lectureId }: LectureTimerProps) {
  const [startTime, setStartTime] = useLocalStorage<number>(`lecture-${lectureId}-startTime`, Date.now());
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const isVisible = useVisibility();

  useEffect(() => {
    // Calculate initial elapsed time when component mounts
    setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    
    // Set up timer to update elapsed time
    const intervalId = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    
    return () => clearInterval(intervalId);
  }, [startTime]);

  // Format time as MM:SS or HH:MM:SS
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
  };

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 backdrop-blur-sm bg-white/90 dark:bg-gray-800/90 border border-gray-200/60 dark:border-gray-700/60 rounded-xl shadow-md">
      <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
        <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
      </div>
      <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 tabular-nums">
        {formatTime(elapsedTime)}
      </span>
    </div>
  );
}
