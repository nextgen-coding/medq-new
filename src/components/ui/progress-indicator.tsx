import { motion } from 'framer-motion';

interface ProgressIndicatorProps {
  message?: string;
}

export function ProgressIndicator({ message = "Loading..." }: ProgressIndicatorProps) {
  return (
    <div className="flex flex-col items-center justify-center space-y-4 p-8">
      <div className="relative">
        <div className="w-12 h-12 border-4 border-blue-200 rounded-full animate-spin">
          <div className="absolute top-0 left-0 w-12 h-12 border-4 border-transparent border-t-blue-600 rounded-full animate-spin"></div>
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