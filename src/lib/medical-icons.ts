import { 
  Heart, 
  Brain, 
  Bone, 
  Baby, 
  Scissors, 
  Eye, 
  Microscope, 
  Scan, 
  Stethoscope,
  Thermometer,
  Pill,
  Syringe,
  BookOpen,
  TestTube,
  Hospital,
  Bandage,
  Zap,
  Users,
  Shield,
  Activity,
  Waves,
  Ear,
  Footprints,
  PersonStanding,
  FlaskConical,
  LucideIcon
} from 'lucide-react';

export interface MedicalIcon {
  name: string;
  icon: LucideIcon;
  label: string;
  color: string;
  darkColor: string;
  keywords: string[];
}

export const MEDICAL_ICONS: Record<string, MedicalIcon> = {
  // Cardiology
  'heart': {
    name: 'heart',
    icon: Heart,
    label: 'Cardiologie',
    color: 'text-red-500',
    darkColor: 'dark:text-red-400',
    keywords: ['cardio', 'heart', 'coeur', 'cardiovascular']
  },
  
  // Neurology
  'brain': {
    name: 'brain',
    icon: Brain,
    label: 'Neurologie',
  color: 'text-medblue-500',
  darkColor: 'dark:text-medblue-400',
    keywords: ['neuro', 'brain', 'cerveau', 'neurologie']
  },
  
  // Orthopedics
  'bone': {
    name: 'bone',
    icon: Bone,
    label: 'Orthopédie',
    color: 'text-gray-600',
    darkColor: 'dark:text-gray-400',
    keywords: ['ortho', 'bone', 'os', 'orthopédie']
  },
  
  // Pediatrics
  'baby': {
    name: 'baby',
    icon: Baby,
    label: 'Pédiatrie',
    color: 'text-pink-500',
    darkColor: 'dark:text-pink-400',
    keywords: ['pediatric', 'enfant', 'baby', 'pédiatrie']
  },
  
  // Surgery
  'scissors': {
    name: 'scissors',
    icon: Scissors,
    label: 'Chirurgie',
    color: 'text-amber-500',
    darkColor: 'dark:text-amber-400',
    keywords: ['surgery', 'chirurgie', 'operation']
  },
  
  // Ophthalmology
  'eye': {
    name: 'eye',
    icon: Eye,
    label: 'Ophtalmologie',
    color: 'text-blue-500',
    darkColor: 'dark:text-blue-400',
    keywords: ['ophta', 'eye', 'oeil', 'ophtalmologie']
  },
  
  // Pathology
  'microscope': {
    name: 'microscope',
    icon: Microscope,
    label: 'Pathologie',
    color: 'text-emerald-600',
    darkColor: 'dark:text-emerald-400',
    keywords: ['patho', 'microscope', 'pathologie']
  },
  
  // Radiology
  'scan': {
    name: 'scan',
    icon: Scan,
    label: 'Radiologie',
    color: 'text-indigo-500',
    darkColor: 'dark:text-indigo-400',
    keywords: ['radio', 'scan', 'radiologie', 'imaging']
  },
  
  // General Medicine
  'stethoscope': {
    name: 'stethoscope',
    icon: Stethoscope,
    label: 'Médecine Générale',
    color: 'text-green-600',
    darkColor: 'dark:text-green-400',
    keywords: ['general', 'medicine', 'générale', 'family']
  },
  
  // Anesthesiology
  'thermometer': {
    name: 'thermometer',
    icon: Thermometer,
    label: 'Anesthésiologie',
    color: 'text-gray-500',
    darkColor: 'dark:text-gray-400',
    keywords: ['anesth', 'anesthesia', 'anesthésiologie']
  },
  
  // Pharmacology
  'pill': {
    name: 'pill',
    icon: Pill,
    label: 'Pharmacologie',
    color: 'text-green-500',
    darkColor: 'dark:text-green-400',
    keywords: ['pharma', 'drug', 'médicament', 'pharmacologie']
  },
  
  // Immunology
  'syringe': {
    name: 'syringe',
    icon: Syringe,
    label: 'Immunologie',
    color: 'text-teal-500',
    darkColor: 'dark:text-teal-400',
    keywords: ['immun', 'vaccine', 'vaccination', 'immunologie']
  },
  
  // Psychiatry
  'book-open': {
    name: 'book-open',
    icon: BookOpen,
    label: 'Psychiatrie',
    color: 'text-violet-500',
    darkColor: 'dark:text-violet-400',
    keywords: ['psych', 'mental', 'psychiatrie']
  },
  
  // Laboratory Medicine
  'test-tube': {
    name: 'test-tube',
    icon: TestTube,
    label: 'Médecine de Laboratoire',
    color: 'text-blue-400',
    darkColor: 'dark:text-blue-300',
    keywords: ['lab', 'laboratoire', 'biology', 'biologie']
  },
  
  // Emergency Medicine
  'hospital': {
    name: 'hospital',
    icon: Hospital,
    label: 'Médecine d\'Urgence',
    color: 'text-red-600',
    darkColor: 'dark:text-red-400',
    keywords: ['emergency', 'urgence', 'hospital']
  },
  
  // Infectious Diseases
  'bandage': {
    name: 'bandage',
    icon: Bandage,
    label: 'Maladies Infectieuses',
    color: 'text-orange-500',
    darkColor: 'dark:text-orange-400',
    keywords: ['infect', 'infection', 'infectieuses']
  },
  
  // Dermatology
  'shield': {
    name: 'shield',
    icon: Shield,
    label: 'Dermatologie',
    color: 'text-yellow-600',
    darkColor: 'dark:text-yellow-400',
    keywords: ['derma', 'skin', 'peau', 'dermatologie']
  },
  
  // Pulmonology
  'waves': {
    name: 'waves',
    icon: Waves,
    label: 'Pneumologie',
    color: 'text-cyan-500',
    darkColor: 'dark:text-cyan-400',
    keywords: ['pulmo', 'lung', 'poumon', 'pneumologie', 'respiratory']
  },
  
  // Rheumatology
  'person-standing': {
    name: 'person-standing',
    icon: PersonStanding,
    label: 'Rhumatologie',
    color: 'text-slate-600',
    darkColor: 'dark:text-slate-400',
    keywords: ['rheumat', 'joint', 'articulation', 'rhumatologie']
  },
  
  // ENT (Otorhinolaryngology)
  'ear': {
    name: 'ear',
    icon: Ear,
    label: 'ORL',
    color: 'text-rose-500',
    darkColor: 'dark:text-rose-400',
    keywords: ['orl', 'ear', 'nose', 'throat', 'oreille', 'nez', 'gorge']
  },
  
  // Urology
  'footprints': {
    name: 'footprints',
    icon: Footprints,
    label: 'Urologie',
    color: 'text-lime-600',
    darkColor: 'dark:text-lime-400',
    keywords: ['uro', 'kidney', 'rein', 'urologie']
  },
  
  // Endocrinology
  'activity': {
    name: 'activity',
    icon: Activity,
    label: 'Endocrinologie',
    color: 'text-fuchsia-500',
    darkColor: 'dark:text-fuchsia-400',
    keywords: ['endocrin', 'hormone', 'endocrinologie', 'diabetes']
  },
  
  // Gastroenterology
  'flask-conical': {
    name: 'flask-conical',
    icon: FlaskConical,
    label: 'Gastroentérologie',
    color: 'text-amber-600',
    darkColor: 'dark:text-amber-400',
    keywords: ['gastro', 'digest', 'stomach', 'estomac', 'gastroentérologie']
  },
  
  // Oncology
  'zap': {
    name: 'zap',
    icon: Zap,
    label: 'Oncologie',
  color: 'text-medblue-600',
  darkColor: 'dark:text-medblue-400',
    keywords: ['onco', 'cancer', 'oncologie', 'tumor']
  },
  
  // Public Health
  'users': {
    name: 'users',
    icon: Users,
    label: 'Santé Publique',
    color: 'text-blue-600',
    darkColor: 'dark:text-blue-400',
    keywords: ['public', 'health', 'santé', 'population', 'epidemiology']
  }
};

export const DEFAULT_ICON_NAME = 'stethoscope';

// Get icon by name with fallback to default
export function getMedicalIcon(iconName?: string): MedicalIcon {
  if (!iconName || !MEDICAL_ICONS[iconName]) {
    return MEDICAL_ICONS[DEFAULT_ICON_NAME];
  }
  return MEDICAL_ICONS[iconName];
}

// Get icon based on specialty name (smart matching)
export function getIconBySpecialtyName(specialtyName: string): MedicalIcon {
  const name = specialtyName.toLowerCase();
  
  // Find icon by keyword matching
  for (const [iconName, iconData] of Object.entries(MEDICAL_ICONS)) {
    if (iconData.keywords.some(keyword => name.includes(keyword))) {
      return iconData;
    }
  }
  
  // Fallback to default
  return MEDICAL_ICONS[DEFAULT_ICON_NAME];
}

// Get all available icons for selection
export function getAllMedicalIcons(): MedicalIcon[] {
  return Object.values(MEDICAL_ICONS);
}

// Get icon names as array
export function getMedicalIconNames(): string[] {
  return Object.keys(MEDICAL_ICONS);
}
