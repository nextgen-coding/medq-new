'use client';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Edit2, Trash2, Play, Lock, Pin, PinOff } from 'lucide-react';
import { Specialty } from '@/types';
import { useRouter } from 'next/navigation';
import { getMedicalIcon, getIconBySpecialtyName } from '@/lib/medical-icons';

interface ExerciseCardProps {
  specialty: Specialty;
  onEdit?: (specialty: Specialty) => void;
  onDelete?: (specialty: Specialty) => void;
  isPinned?: boolean;
  onPin?: (specialty: Specialty) => void;
  onUnpin?: (specialty: Specialty) => void;
}

export function ExerciseCard({ specialty, onEdit, onDelete, isPinned = false, onPin, onUnpin }: ExerciseCardProps) {
  const { isAdmin } = useAuth();
  const { hasActiveSubscription } = useSubscription();
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);

  const medicalIcon = specialty.icon ? getMedicalIcon(specialty.icon) : getIconBySpecialtyName(specialty.name);
  const IconComponent = medicalIcon.icon;
  
  // Use the iconColor from specialty data, fallback to emerald if not set
  const iconColor = specialty.iconColor || '#10b981'; // emerald-500 as fallback
  
  // Debug log to check if iconColor is being received (remove in production)
  if (process.env.NODE_ENV === 'development') {
    console.log(`Specialty "${specialty.name}":`, {
      iconType: specialty.iconType,
      icon: specialty.icon,
      iconColor: specialty.iconColor,
      imageUrl: specialty.imageUrl,
      resolvedColor: iconColor
    });
  }

  // Use progress data from API - it's already calculated correctly
  const totalQuestions = specialty.progress?.totalQuestions || specialty._count?.questions || 0;
  const completedQuestions = specialty.progress?.completedQuestions || 0;
  
  // Use the questionProgress from API if available, otherwise calculate
  const progress = specialty.progress?.questionProgress !== undefined 
    ? Math.max(0, Math.min(100, specialty.progress.questionProgress))
    : totalQuestions > 0 
      ? Math.max(0, Math.min(100, Math.round((completedQuestions / totalQuestions) * 100)))
      : 0;
  
  const canAccess = specialty.isFree || hasActiveSubscription || isAdmin;

  const handleCardClick = () => {
    if (canAccess) router.push(`/matieres/${specialty.id}`);
  };

  const handleEdit = (e: React.MouseEvent) => { e.stopPropagation(); onEdit?.(specialty); };
  const handleDelete = (e: React.MouseEvent) => { e.stopPropagation(); onDelete?.(specialty); };

  return (
    <Card
      className={`relative overflow-hidden cursor-pointer transition-all duration-300 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl ${canAccess ? 'hover:shadow-lg hover:-translate-y-0.5' : 'opacity-70 cursor-not-allowed'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
    >
      {/* Pin + Admin Controls */}
      {isHovered && (onPin || onUnpin) && (
        <div className="absolute top-4 left-4 z-20">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              if (isPinned && onUnpin) onUnpin(specialty); else if (!isPinned && onPin) onPin(specialty);
            }}
            className={`h-8 w-8 p-0 transition-colors ${isPinned ? 'hover:bg-yellow-50 dark:hover:bg-yellow-900/20 text-yellow-600' : 'hover:bg-gray-50 dark:hover:bg-gray-900/20 text-gray-600'}`}
            title={isPinned ? 'Désépingler la matière' : 'Épingler la matière'}
          >
            {isPinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
          </Button>
        </div>
      )}
      {isPinned && !isHovered && (
        <div className="absolute top-3 left-3 z-20">
          <div className="bg-yellow-100 dark:bg-yellow-900/30 rounded-full p-1.5 shadow-sm">
            <Pin className="h-3 w-3 text-yellow-600 dark:text-yellow-400" />
          </div>
        </div>
      )}
      {isAdmin && isHovered && (
        <div className="absolute top-4 right-4 flex gap-1 z-20">
          <Button variant="ghost" size="sm" onClick={handleEdit} className="h-8 w-8 p-0 hover:bg-blue-50 dark:hover:bg-blue-900/20">
            <Edit2 className="h-3 w-3 text-blue-600" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDelete} className="h-8 w-8 p-0 hover:bg-red-50 dark:hover:bg-red-900/20">
            <Trash2 className="h-3 w-3 text-red-600" />
          </Button>
        </div>
      )}

      <CardContent className="p-0">
        {/* Top Section */}
        <div className="px-7 pt-7 pb-5 flex flex-col items-center text-center bg-gray-50 dark:bg-gray-800/60 rounded-t-xl transition-colors">
          <div className="relative mb-3">
            <div 
              className="flex items-center justify-center w-28 h-28 rounded-full text-white overflow-hidden border-2 border-white shadow-lg"
              style={{ backgroundColor: specialty.iconType === 'image' ? '#f3f4f6' : iconColor }}
            >
              {specialty.iconType === 'image' && specialty.imageUrl ? (
                <img 
                  src={specialty.imageUrl} 
                  alt={`${specialty.name} icon`}
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                <IconComponent className="w-14 h-14" />
              )}
            </div>
            {!canAccess && (
              <div className="absolute top-0 right-0 -mt-1 -mr-1 flex items-center justify-center w-8 h-8 bg-amber-100 dark:bg-amber-900/50 rounded-full border border-amber-200 dark:border-amber-700">
                <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
            )}
          </div>
          <h3 className={`text-[20px] font-semibold tracking-tight leading-snug line-clamp-2 ${canAccess ? 'text-gray-800 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}>{specialty.name}</h3>
        </div>
        {/* Divider */}
        <div className="border-t border-gray-200 dark:border-gray-800" />
        {/* Bottom Section */}
        <div className="px-6 pt-4 pb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px] font-medium text-gray-800 dark:text-gray-200">Progrès global</span>
            <span className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">{progress}%</span>
          </div>
          
          {/* Enhanced Progress Bar */}
          <div className="w-full mb-3">
            <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden shadow-inner border border-gray-100 dark:border-gray-600">
              <div 
                className={`h-full rounded-full transition-all duration-700 ease-out relative ${
                  canAccess 
                    ? progress > 0 
                      ? 'bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 shadow-sm' 
                      : 'bg-gray-300 dark:bg-gray-600'
                    : 'bg-gray-400 dark:bg-gray-500'
                }`}
                style={{ 
                  width: `${progress}%`,
                  minWidth: progress > 0 && progress < 2 ? '8px' : '0px',
                  transition: 'width 0.7s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              >
                {/* Shine effect for active progress */}
                {canAccess && progress > 0 && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-3">
            <span className="flex items-center gap-1.5">
              <span className={`inline-block w-1.5 h-1.5 rounded-full transition-colors ${
                canAccess 
                  ? progress > 0 
                    ? 'bg-blue-600 shadow-sm' 
                    : 'bg-gray-400'
                  : 'bg-gray-400'
              }`} />
              <span className="tabular-nums">
                {completedQuestions.toLocaleString()} / {totalQuestions.toLocaleString()}
              </span>
              <span className="text-gray-500 dark:text-gray-500">questions</span>
            </span>
            <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
              <span className="tabular-nums">{specialty._count?.lectures || 0}</span>
              <span>cours</span>
            </span>
          </div>
          <Button
            className={`w-full h-10 text-[14px] font-medium rounded-md bg-gradient-to-r ${canAccess ? 'from-blue-600 via-blue-600 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white shadow-sm' : 'from-gray-300 to-gray-400 text-gray-600 cursor-not-allowed'} transition-colors duration-200`}
            onClick={(e) => { e.stopPropagation(); handleCardClick(); }}
            disabled={!canAccess}
          >
            <Play className="w-4 h-4 mr-2" />
            {progress > 0 ? 'Continuer' : 'Commencer l\'apprentissage'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
