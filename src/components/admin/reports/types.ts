
export interface Report {
  id: string;
  question_id: string;
  lecture_id: string;
  message: string;
  status: 'pending' | 'reviewed' | 'dismissed';
  created_at: string;
  question: {
    text: string;
    type: string;
  } | null;
  lecture: {
    title: string;
  } | null;
  profile: {
    email: string;
  } | null;
}
