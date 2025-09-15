import React from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { getMedicalIcon, getAllMedicalIcons, DEFAULT_ICON_NAME, MedicalIcon } from '@/lib/medical-icons';
import { useTranslation } from 'react-i18next';

interface IconSelectorProps {
  value?: string;
  onChange: (iconName: string) => void;
  label?: string;
  className?: string;
}

export function IconSelector({ value, onChange, label, className }: IconSelectorProps) {
  const { t } = useTranslation();
  const allIcons = getAllMedicalIcons();
  const selectedIcon = getMedicalIcon(value);

  const handleIconSelect = (iconName: string) => {
    onChange(iconName);
  };

  const SelectedIconComponent = selectedIcon.icon;

  return (
    <div className={cn("space-y-3", className)}>
      {label && <Label>{label}</Label>}
      
      {/* Selected Icon Display */}
      <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
        <div className={cn(
          "flex items-center justify-center w-10 h-10 rounded-lg bg-white dark:bg-gray-800 border",
          selectedIcon.color,
          selectedIcon.darkColor
        )}>
          <SelectedIconComponent className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium">{selectedIcon.label}</div>
          <div className="text-xs text-muted-foreground">
            {t('specialties.iconSelected')}: {selectedIcon.name}
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handleIconSelect(DEFAULT_ICON_NAME)}
          className="text-xs"
        >
          {t('specialties.resetToDefault')}
        </Button>
      </div>

      {/* Icon Grid */}
      <div className="border rounded-lg p-2">
        <div className="text-sm font-medium mb-2 px-2">
          {t('specialties.chooseIcon')}
        </div>
        <ScrollArea className="h-64">
          <div className="grid grid-cols-4 gap-2 p-2">
            {allIcons.map((iconData) => {
              const IconComponent = iconData.icon;
              const isSelected = value === iconData.name;
              
              return (
                <Button
                  key={iconData.name}
                  type="button"
                  variant={isSelected ? "default" : "ghost"}
                  size="sm"
                  onClick={() => handleIconSelect(iconData.name)}
                  className={cn(
                    "h-16 flex-col gap-1 p-2 transition-all duration-200",
                    isSelected ? 
                      "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700" :
                      "hover:bg-blue-50 dark:hover:bg-blue-900/10"
                  )}
                  title={iconData.label}
                >
                  <div className={cn(
                    "flex items-center justify-center w-8 h-8 rounded transition-colors",
                    isSelected ? 
                      "text-blue-600 dark:text-blue-400" : 
                      iconData.color + " " + iconData.darkColor
                  )}>
                    <IconComponent className="w-5 h-5" />
                  </div>
                  <span className="text-xs text-center leading-tight truncate w-full">
                    {iconData.label.split(' ')[0]}
                  </span>
                </Button>
              );
            })}
          </div>
        </ScrollArea>
      </div>
      
      <div className="text-xs text-muted-foreground">
        {t('specialties.iconHint')}
      </div>
    </div>
  );
}
