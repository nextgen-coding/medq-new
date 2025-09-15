
export type Niveau = {
  id: string;
  name: string;
  order: number;
};

export type User = {
  id: string;
  email: string;
  role: 'student' | 'maintainer' | 'admin';
  name?: string;
  image?: string;
  password?: string;
  passwordUpdatedAt?: string;
  // Profile fields
  sexe?: 'M' | 'F';
  niveauId?: string;
  semesterId?: string;
  profileCompleted?: boolean;
  // Subscription fields
  hasActiveSubscription?: boolean;
  subscriptionExpiresAt?: string;
  niveau?: {
    id: string;
    name: string;
    order: number;
  };
  semester?: {
    id: string;
    name: string;
    order: number;
    niveauId: string;
  };
};

export type Specialty = {
  id: string;
  name: string;
  icon?: string;
  iconType?: 'icon' | 'image';
  iconColor?: string | null;
  imageUrl?: string | null;
  description?: string;
  niveauId?: string;
  semesterId?: string;
  isFree?: boolean;
  niveau?: {
    id: string;
    name: string;
  };
  semester?: {
    id: string;
    name: string;
    order: number;
    niveauId: string;
  };
  progress?: SpecialtyProgress;
  _count?: {
    lectures?: number;
    questions?: number;
  };
};

export type Semester = {
  id: string;
  name: string;
  order: number;
  niveauId: string;
};

export type SpecialtyProgress = {
  totalLectures: number;
  completedLectures: number;
  totalQuestions: number;
  completedQuestions: number;
  lectureProgress: number;
  questionProgress: number;
  averageScore: number;
  // Additional fields for detailed progress
  correctQuestions: number;
  incorrectQuestions: number;
  partialQuestions: number;
  incompleteQuestions: number;
};

export type Lecture = {
  id: string;
  specialtyId: string;
  title: string;
  description?: string;
  isFree?: boolean;
  specialty?: {
    id: string;
    name: string;
    niveauId?: string;
    niveau?: {
      id: string;
      name: string;
    };
  };
  progress?: LectureProgress;
  reportsCount?: number; // Only available for admins
  commentsCount?: number; // Total comments on lecture
  culmonNote?: number; // Moyenne sur 20
};

export type LectureProgress = {
  totalQuestions: number;
  completedQuestions: number;
  percentage: number;
  correctAnswers: number;
  incorrectAnswers: number;
  partialAnswers: number;
  lastAccessed?: Date;
};

export type QuestionType = 'mcq' | 'open' | 'qroc' | 'clinic_mcq' | 'clinic_croq' | 'clinical_case';

export type Option = {
  id: string;
  text: string;
  explanation?: string;
};

export type Question = {
  id: string;
  lectureId: string;
  lecture_id: string;
  type: QuestionType;
  text: string;
  options?: Option[];
  correct_answers?: string[]; // Array of option IDs for MCQ
  correctAnswers?: string[]; // Keep for backward compatibility
  explanation?: string; // Keep for backward compatibility
  course_reminder?: string; // Field for "Rappel du cours"
  number?: number; // Question number
  session?: string; // Exam session (e.g., "Session 2022")
  media_url?: string; // URL to the media file
  media_type?: 'image' | 'video'; // Type of media
  // Separate media for the Rappel du cours
  course_reminder_media_url?: string;
  course_reminder_media_type?: 'image' | 'video';
  hidden?: boolean; // Whether the question is hidden from students
  // Clinical case fields
  caseNumber?: number; // Case number for clinical cases
  caseText?: string; // Case description text
  caseQuestionNumber?: number; // Question number within the case
  parent_question_id?: string; // Link to parent case question
  children?: Question[]; // For UI convenience when grouping
};

// New type for grouped clinical cases
export type ClinicalCase = {
  caseNumber: number;
  caseText: string;
  questions: Question[];
  totalQuestions: number;
};

export type Answer = {
  id: string;
  userId: string;
  questionId: string;
  selectedOptions?: string[]; // For MCQ
  textAnswer?: string; // For open questions
  isCorrect?: boolean;
};

export type UserProgress = {
  id: string;
  userId: string;
  lectureId: string;
  questionId?: string;
  completed: boolean;
  score?: number;
  lastAccessed: Date;
  createdAt: Date;
  updatedAt: Date;
};

// Structured session correction data and submission types
export type SessionCorrectionData = {
  tables: {
    id: string;
    title?: string;
    headers: string[];
    rows: string[][];
    compareMode?: 'exact' | 'case-insensitive' | 'set';
    type?: 'standard' | 'medical-qcm'; // Type to distinguish medical QCMs
  }[];
  texts: {
    id: string;
    title?: string;
    reference: string;
    keywords?: string[];
    scoring?: { full: number; partial?: number };
  }[];
  medicalQuestions?: {
    id: string;
    questionNumber: string;
    type: 'qcm' | 'qroc';
    question: string;
    options?: string[]; // For QCM: ['a) Option A', 'b) Option B', ...]
    correctAnswers?: string[]; // For QCM: ['a', 'c'] or for QROC: ['answer text']
    explanation?: string;
  }[];
  clinicalCases?: {
    id: string;
    title: string;
    enonce: string; // Clinical scenario description
    questions: {
      id: string;
      questionNumber: string;
      type: 'qcm' | 'qroc';
      question: string;
      options?: string[]; // For QCM: ['a) Option A', 'b) Option B', ...]
      correctAnswers?: string[]; // For QCM: ['a', 'c'] or for QROC: ['answer text']
      explanation?: string;
    }[];
  }[];
};

export type SessionCorrection = {
  id: string;
  sessionId: string;
  data: SessionCorrectionData;
  createdBy: string;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type SessionCorrectionSubmission = {
  id: string;
  sessionId: string;
  userId: string;
  answers: {
    tables: { id: string; rows: string[][] }[];
    texts: { id: string; answer: string }[];
    medicalAnswers?: { 
      questionId: string; 
      selectedOptions?: string[]; // For QCM: ['a', 'c']
      textAnswer?: string; // For QROC
    }[];
    clinicalCaseAnswers?: {
      caseId: string;
      questionAnswers: {
        questionId: string;
        selectedOptions?: string[]; // For QCM: ['a', 'c']
        textAnswer?: string; // For QROC
      }[];
    }[];
  };
  score?: number;
  createdAt: string | Date;
  updatedAt: string | Date;
};
