'use client';
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Calendar, Edit, Trash2, MoreVertical } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getMedicalIcon, getIconBySpecialtyName } from '@/lib/medical-icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface SessionSpecialty {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  iconColor?: string;
  iconType?: string;
  imageUrl?: string;
  _count?: { sessions?: number };
}

interface Props {
  specialty: SessionSpecialty;
  onEdit?: () => void;
  onDelete?: () => void;
  isUpdating?: boolean;
}

export function SessionSpecialtyCard({ specialty, onEdit, onDelete, isUpdating }: Props) {
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);

  const medicalIcon = specialty.icon ? getMedicalIcon(specialty.icon) : getIconBySpecialtyName(specialty.name);
  const IconComponent = medicalIcon.icon;
  const iconColor = specialty.iconColor || '#10b981'; // Default emerald-500 fallback

  const sessionCount = specialty._count?.sessions || 0;
  
  const handleCardClick = () => {
    router.push(`/session/${specialty.id}?name=${encodeURIComponent(specialty.name)}`);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.();
  };

  const showAdminControls = onEdit || onDelete;

  return (
    <Card
      className="relative overflow-hidden cursor-pointer transition-all duration-300 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl hover:shadow-lg hover:-translate-y-0.5"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
    >
      <CardContent className="p-0">
        {/* Admin Controls */}
        {showAdminControls && (
          <div className="absolute top-2 right-2 z-10">
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm hover:bg-white/90 dark:hover:bg-gray-800/90 shadow-sm"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onEdit && (
                  <DropdownMenuItem onClick={handleEdit}>
                    <Edit className="h-4 w-4 mr-2" />
                    Gérer les sessions
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem 
                    onClick={handleDelete}
                    className="text-red-600 dark:text-red-400"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Supprimer
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

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
          </div>
          <h3 className="text-[20px] font-semibold tracking-tight leading-snug line-clamp-2 text-gray-800 dark:text-gray-100">
            {specialty.name}
          </h3>
        </div>
        
        {/* Divider */}
        <div className="border-t border-gray-200 dark:border-gray-800" />
        
        {/* Bottom Section */}
        <div className="px-6 pt-4 pb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px] font-medium text-gray-800 dark:text-gray-200">Sessions disponibles</span>
            <span className={`text-[13px] font-semibold text-gray-900 dark:text-gray-100 transition-all duration-300 ${isUpdating ? 'opacity-50 scale-95' : ''}`}>
              {sessionCount}
            </span>
          </div>
          
          {/* Sessions Progress Bar */}
          <div className="w-full mb-3">
            <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden shadow-inner border border-gray-100 dark:border-gray-600">
              <div 
                className="h-full rounded-full transition-all duration-700 ease-out relative bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 shadow-sm"
                style={{ 
                  width: sessionCount > 0 ? '100%' : '0%',
                  minWidth: sessionCount > 0 ? '8px' : '0px',
                  transition: 'width 0.7s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              >
                {/* Shine effect for sessions */}
                {sessionCount > 0 && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-3">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-600 shadow-sm transition-colors" />
              <Calendar className="h-3 w-3" />
              <span className="tabular-nums">{sessionCount}</span>
              <span className="text-gray-500 dark:text-gray-500">session{sessionCount > 1 ? 's' : ''}</span>
            </span>
            <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
              <span>Examens</span>
            </span>
          </div>
          
          <Button
            className="w-full h-10 text-[14px] font-medium rounded-md bg-gradient-to-r from-blue-600 via-blue-600 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white shadow-sm transition-colors duration-200"
            onClick={(e) => { e.stopPropagation(); handleCardClick(); }}
          >
            <Play className="w-4 h-4 mr-2" />
            Commencer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
