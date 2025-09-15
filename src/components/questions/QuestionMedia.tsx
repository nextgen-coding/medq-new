
import { Question } from '@/types';

interface QuestionMediaProps {
  question: Question;
  className?: string;
}

export function QuestionMedia({ question, className = "" }: QuestionMediaProps) {
  if (!question.media_url || !question.media_type) {
    return null;
  }
  
  return (
    <div className={`rounded-md overflow-hidden ${className}`}>
      {question.media_type === 'image' ? (
        <img 
          src={question.media_url} 
          alt="Question illustration" 
          className="w-full object-contain max-h-[300px]"
        />
      ) : question.media_type === 'video' ? (
        <video 
          src={question.media_url} 
          controls 
          className="w-full max-h-[300px]"
        />
      ) : null}
    </div>
  );
}
