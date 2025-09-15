import { NextResponse } from 'next/server';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';

// Returns lectures for the current user whose average personal score is < 50% (i.e. <10/20)
async function getHandler(request: AuthenticatedRequest) {
  try {
  const userId = request.user?.userId;
  const { searchParams } = new URL(request.url);
  const specialtyIdFilter = searchParams.get('specialtyId') || undefined;
  const pinnedOnly = searchParams.get('pinnedOnly') === '1';
    if(!userId){
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all user progress entries (need completed + score for accurate average like lectures endpoint)
    const baseWhere: any = { userId };
    if (specialtyIdFilter) baseWhere.lecture = { specialtyId: specialtyIdFilter };
    const progresses = await prisma.userProgress.findMany({
      where: baseWhere,
      select: {
        lectureId: true,
        score: true,
        completed: true,
        lecture: {
          select: {
            title: true,
            specialtyId: true,
            specialty: { select: { name: true } },
            questions: { select: { id: true } },
            isFree: true
          }
        }
      }
    });

    // If pinnedOnly, load user's pinned specialties set for filtering below
    let pinnedSpecialtyIds: Set<string> | null = null;
    if (pinnedOnly) {
      const pins = await prisma.pinnedSpecialty.findMany({ where: { userId }, select: { specialtyId: true } });
      pinnedSpecialtyIds = new Set(pins.map(p => p.specialtyId));
    }

    // Aggregate scores per lecture (scores assumed already percent 0..100)
  const byLecture: Record<string, { title: string; specialty: { name: string }; specialtyId?: string; scores: number[]; completedScores: number[]; questionCount: number; isFree: boolean; }>= {};
    for(const p of progresses){
      const key = p.lectureId;
      if(!byLecture[key]){
        byLecture[key] = { title: p.lecture.title, specialty: p.lecture.specialty, specialtyId: p.lecture.specialtyId, scores: [], completedScores: [], questionCount: p.lecture.questions.length, isFree: p.lecture.isFree };
      }
      if(typeof p.score === 'number'){
        byLecture[key].scores.push(p.score);
        if(p.completed) byLecture[key].completedScores.push(p.score);
      }
    }

    let result = Object.entries(byLecture).map(([lectureId, v])=>{
      // Mirror lectures endpoint: average only of completed question scores
      const base = v.completedScores.length? (v.completedScores.reduce((a,b)=>a+b,0)/v.completedScores.length):0;
      const averageScore = Math.round(base * 1000)/10; // percent with 1 decimal (0-100)
      return {
        id: lectureId,
        title: v.title,
  specialty: v.specialty,
  specialtyId: v.specialtyId,
        questionCount: v.questionCount,
        studentCount: 1, // personal, keep field for component compatibility
        averageScore, // already 0..100 with 1 decimal
        isFree: v.isFree
      };
    })
    .filter(c => c.averageScore < 50) // below 10/20
    .sort((a,b)=> a.averageScore - b.averageScore) // lowest first
    .slice(0, 20);

    if (pinnedSpecialtyIds) {
      result = result.filter(r => r.specialtyId && pinnedSpecialtyIds!.has(r.specialtyId));
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching courses to review:', error);
    return NextResponse.json({ error: 'Failed to fetch courses to review' }, { status: 500 });
  }
}

export const GET = requireAuth(getHandler);
