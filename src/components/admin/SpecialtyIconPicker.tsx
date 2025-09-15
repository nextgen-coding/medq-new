import React from 'react';
import {
  BookOpen,
  Brain,
  Stethoscope,
  HeartPulse,
  Microscope,
  Dna,
  Pill,
  Syringe,
  Bone,
  FlaskConical,
  Globe2
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const SPECIALTY_ICON_NAMES = [
  'BookOpen','Brain','Stethoscope','HeartPulse','Microscope','Dna','Pill','Syringe','Bone','FlaskConical','Globe2'
] as const;

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  BookOpen, Brain, Stethoscope, HeartPulse, Microscope, Dna, Pill, Syringe, Bone, FlaskConical, Globe2
};

export function getSpecialtyIcon(name?: string | null){
  const Cmp = (name && ICON_MAP[name]) || BookOpen;
  return <Cmp className="w-5 h-5" />;
}

interface PickerProps { value?: string | null; onChange: (val: string)=>void; }
export function SpecialtyIconPicker({ value, onChange }: PickerProps){
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-blue-700 dark:text-blue-300">Icône de la spécialité</label>
      <div className="grid grid-cols-6 gap-2">
        {SPECIALTY_ICON_NAMES.map(name=>{
          const Icon = ICON_MAP[name];
          const active = value === name;
          return (
            <button
              type="button"
              key={name}
              onClick={()=>onChange(name)}
              className={cn(
                'flex items-center justify-center h-10 rounded-lg border text-muted-foreground hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:text-blue-600 dark:hover:text-blue-300 transition-all duration-200', 
                active && 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-300 shadow-sm'
              )}
              title={name}
            >
              <Icon className="w-5 h-5" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
