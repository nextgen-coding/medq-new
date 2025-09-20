import { motion } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';


interface ProgressIndicatorProps {
  message?: string;
}

export function ProgressIndicator({ message = "Loading..." }: ProgressIndicatorProps) {
  const { theme } = useTheme();
  // Colors for light/dark mode
  const borderColor = theme === 'dark' ? 'border-gray-700' : 'border-blue-200';
  const spinnerColor = theme === 'dark' ? 'border-t-blue-400' : 'border-t-blue-600';
  return (
    <div className="flex flex-col items-center justify-center space-y-4 p-8">
      <div className="relative">
        <div className={`w-12 h-12 border-4 rounded-full animate-spin ${borderColor}`}>
          <div className={`absolute top-0 left-0 w-12 h-12 border-4 border-transparent rounded-full animate-spin ${spinnerColor}`}></div>
        </div>
      </div>
      <motion.p 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-sm text-muted-foreground"
      >
        {message}
      </motion.p>
    </div>
  );
}