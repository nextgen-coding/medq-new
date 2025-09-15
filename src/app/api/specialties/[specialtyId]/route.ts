import { NextResponse } from 'next/server';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';

async function getHandler(
  request: AuthenticatedRequest,
  { params }: { params: Promise<{ specialtyId: string }> }
) {
  try {
    const { specialtyId } = await params;
    const userId = request.user?.userId;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('Fetching specialty:', specialtyId, 'for user:', userId);

    // Get specialty with lectures and questions
    const specialty = await prisma.specialty.findUnique({
      where: { id: specialtyId },
      include: {
        niveau: {
          select: {
            id: true,
            name: true
          }
        },
  // semester relation not selected to align with schema access; we can use semesterId scalar if needed
        lectures: {
          include: {
            _count: {
              select: {
                questions: true
              }
            }
          }
        },
        _count: {
          select: {
            lectures: true
          }
        }
      }
    });

    if (!specialty) {
      console.error('Specialty not found:', specialtyId);
      return NextResponse.json(
        { error: 'Specialty not found' },
        { status: 404 }
      );
    }

    console.log('Specialty found:', specialty.name);

    // Calculate total questions across all lectures
  const totalQuestions = (specialty as any).lectures.reduce((sum: number, lecture: any) => {
      return sum + lecture._count.questions;
    }, 0);

    // Get user progress for all questions in this specialty
    const userProgress = await prisma.userProgress.findMany({
      where: {
        userId: userId,
        lecture: {
          specialtyId: specialtyId
        }
      }
    });

    // Calculate progress metrics
    const completedQuestions = userProgress.filter(p => p.completed).length;
    const correctAnswers = userProgress.filter(p => p.completed && (p.score || 0) > 0.7).length;
    const partialAnswers = userProgress.filter(p => p.completed && (p.score || 0) > 0.3 && (p.score || 0) <= 0.7).length;
    const incorrectAnswers = userProgress.filter(p => p.completed && (p.score || 0) <= 0.3).length;

    const questionProgress = totalQuestions > 0 ? (completedQuestions / totalQuestions) * 100 : 0;
    const averageScore = completedQuestions > 0 ? 
      (userProgress.reduce((sum, p) => sum + (p.score || 0), 0) / completedQuestions) * 100 : 0;

    // Calculate lecture progress
    const lectureProgressMap = new Map();
    (specialty as any).lectures.forEach((lecture: any) => {
      const lectureQuestions = lecture._count.questions;
      const lectureUserProgress = userProgress.filter(p => p.lectureId === lecture.id);
      const completedLectureQuestions = lectureUserProgress.filter(p => p.completed).length;
      
      lectureProgressMap.set(lecture.id, {
        totalQuestions: lectureQuestions,
        completedQuestions: completedLectureQuestions,
        percentage: lectureQuestions > 0 ? (completedLectureQuestions / lectureQuestions) * 100 : 0
      });
    });

  const completedLectures = (specialty as any).lectures.filter((lecture: any) => {
      const progress = lectureProgressMap.get(lecture.id);
      return progress && progress.percentage === 100;
    }).length;

  const lectureProgress = ((specialty as any).lectures.length > 0) ? (completedLectures / (specialty as any).lectures.length) * 100 : 0;

    const specialtyWithProgress = {
      ...specialty,
  iconType: (specialty as any).iconType || 'icon',
  iconColor: (specialty as any).iconColor || null,
  imageUrl: (specialty as any).imageUrl || null,
      progress: {
  totalLectures: (specialty as any)._count.lectures,
        completedLectures: completedLectures,
        totalQuestions: totalQuestions,
        completedQuestions: completedQuestions,
        lectureProgress: Math.round(lectureProgress),
        questionProgress: Math.round(questionProgress),
        averageScore: Math.round(averageScore),
        correctQuestions: correctAnswers,
        incorrectQuestions: incorrectAnswers,
        partialQuestions: partialAnswers,
        incompleteQuestions: totalQuestions - completedQuestions
      }
    };

    console.log('Returning specialty with calculated progress:', {
      name: specialtyWithProgress.name,
      progress: specialtyWithProgress.progress
    });
    
    return NextResponse.json(specialtyWithProgress);
  } catch (error) {
    console.error('Error fetching specialty:', error);
    return NextResponse.json(
      { error: 'Failed to fetch specialty', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function putHandler(
  request: AuthenticatedRequest,
  { params }: { params: Promise<{ specialtyId: string }> }
) {
  try {
    const { specialtyId } = await params;
    const { name, description, icon, iconColor, iconType, imageUrl, niveauId, semesterId, isFree } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const data: any = { 
      name, 
      description, 
      icon, 
      iconColor,
      iconType: iconType || 'icon',
      imageUrl,
      isFree 
    };
    
    // Handle niveau relation
    if (niveauId) {
      data.niveauId = niveauId;
    } else {
      data.niveauId = null;
    }
    
    // Handle semester relation  
    if (semesterId) {
      data.semesterId = semesterId;
    } else {
      data.semesterId = null;
    }

    console.log('Updating specialty with data:', data);

    const specialty = await prisma.specialty.update({ 
      where: { id: specialtyId }, 
      data 
    });
    
    return NextResponse.json(specialty);
  } catch (error) {
    console.error('Error updating specialty:', error);
    return NextResponse.json({ error: 'Failed to update specialty' }, { status: 500 });
  }
}

async function deleteHandler(
  request: AuthenticatedRequest,
  { params }: { params: Promise<{ specialtyId: string }> }
) {
  try {
    const { specialtyId } = await params;

    // First, get all lectures in this specialty
    const lectures = await prisma.lecture.findMany({
      where: { specialtyId: specialtyId },
      select: { id: true }
    });

    // Delete all questions for all lectures in this specialty
    if (lectures.length > 0) {
      const lectureIds = lectures.map(lecture => lecture.id);
      await prisma.question.deleteMany({
        where: { lectureId: { in: lectureIds } }
      });

      // Delete all lectures in this specialty
      await prisma.lecture.deleteMany({
        where: { specialtyId: specialtyId }
      });
    }

    // Finally, delete the specialty
    await prisma.specialty.delete({
      where: { id: specialtyId }
    });

    return NextResponse.json({ message: 'Specialty deleted successfully' });
  } catch (error) {
    console.error('Error deleting specialty:', error);
    return NextResponse.json(
      { error: 'Failed to delete specialty' },
      { status: 500 }
    );
  }
}

export const GET = requireAuth(getHandler);
export const PUT = requireAdmin(putHandler);
export const DELETE = requireAdmin(deleteHandler);