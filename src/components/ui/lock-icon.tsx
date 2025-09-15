import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LockIconProps {
  className?: string;
  size?: number;
}

export function LockIcon({ className, size = 16 }: LockIconProps) {
  return (
    <Lock 
      className={cn("text-muted-foreground", className)} 
      size={size}
    />
  );
} 