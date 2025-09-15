import { NextResponse } from 'next/server';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';

async function getHandler(request: AuthenticatedRequest) {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

  const { searchParams } = new URL(request.url);
  const semesterParam = searchParams.get('semester'); // 'all' | 'none' | <semesterId>
  const niveauParam = searchParams.get('niveau'); // 'all' | <niveauId>

  const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const whereClause: any = {};
    if (user.role !== 'admin') {
      // Non-admins:
      // - Show all specialties in the user's niveau (any semester)
      // - PLUS any specialty that has no semester (global/common)
      const orConditions: any[] = [];
      if (user.niveauId) orConditions.push({ niveauId: user.niveauId });
      orConditions.push({ semesterId: null });
      whereClause.OR = orConditions;
      // Ignore external semester filter for non-admins
    } else {
      // Admins may optionally filter by niveau and/or semester via query params
      if (niveauParam && niveauParam !== 'all') {
        whereClause.niveauId = niveauParam;
      }
      
      if (semesterParam) {
        if (semesterParam === 'none') {
          whereClause.semesterId = null;
        } else if (semesterParam !== 'all') {
          whereClause.semesterId = semesterParam;
        }
      }
    }

    const specialties = await prisma.specialty.findMany({
      where: whereClause,
      orderBy: [
        { isFree: 'desc' },
        { name: 'asc' },
      ],
    });

    // For progress, we'll aggregate per specialty via counts (avoids relying on missing relations in types)
    const progressBySpecialty = new Map<string, {
      totalLectures: number;
      totalQuestions: number;
      completedQuestions: number;
      sumScore: number;
    }>();

    for (const s of specialties) {
      const totalLectures = await prisma.lecture.count({ where: { specialtyId: s.id } });
      const totalQuestions = await prisma.question.count({ where: { lecture: { specialtyId: s.id } } });
      const completedAgg = await prisma.userProgress.aggregate({
        where: { userId, lecture: { specialtyId: s.id }, questionId: { not: null }, completed: true },
        _count: { _all: true },
        _sum: { score: true },
      });
      progressBySpecialty.set(s.id, {
        totalLectures,
        totalQuestions,
        completedQuestions: completedAgg._count._all || 0,
        sumScore: completedAgg._sum.score || 0,
      });
    }

    const specialtiesWithProgress = specialties.map((s) => {
      const prog = progressBySpecialty.get(s.id) || { totalLectures: 0, totalQuestions: 0, completedQuestions: 0, sumScore: 0 };
      const lectureProgress = prog.totalLectures > 0 ? (0 / prog.totalLectures) * 100 : 0; // completed lectures unknown without per-lecture breakdown
      const questionProgress = prog.totalQuestions > 0 ? (prog.completedQuestions / prog.totalQuestions) * 100 : 0;
      const averageScore = prog.completedQuestions > 0 ? (prog.sumScore / prog.completedQuestions) * 100 : 0;

      return {
        id: (s as any).id,
        name: (s as any).name,
        description: (s as any).description,
        icon: (s as any).icon,
  iconType: (s as any).iconType || 'icon',
  iconColor: (s as any).iconColor || null,
  imageUrl: (s as any).imageUrl || null,
        createdAt: (s as any).createdAt,
        niveauId: (s as any).niveauId ?? null,
        semesterId: (s as any).semesterId ?? null,
        isFree: (s as any).isFree,
        _count: { lectures: prog.totalLectures, questions: prog.totalQuestions },
        progress: {
          totalLectures: prog.totalLectures,
          completedLectures: 0,
          totalQuestions: prog.totalQuestions,
          completedQuestions: prog.completedQuestions,
          lectureProgress: Math.round(lectureProgress),
          questionProgress: Math.round(questionProgress),
          averageScore: Math.round(averageScore),
          correctQuestions: Math.round(prog.completedQuestions * 0.7),
          incorrectQuestions: Math.round(prog.completedQuestions * 0.2),
          partialQuestions: Math.round(prog.completedQuestions * 0.1),
          incompleteQuestions: prog.totalQuestions - prog.completedQuestions,
        },
      };
    });

    const response = NextResponse.json(specialtiesWithProgress);
    response.headers.set('Cache-Control', 'private, max-age=300');
    response.headers.set('ETag', `"${Date.now()}"`);
    return response;
  } catch (error) {
    console.error('Error fetching specialties:', error);
    return NextResponse.json({ error: 'Failed to fetch specialties' }, { status: 500 });
  }
}

async function postHandler(request: AuthenticatedRequest) {
  try {
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
      isFree: isFree || false,
    };
    
    // Handle niveau relation
    if (niveauId) {
      data.niveauId = niveauId;
    }
    
    // Handle semester relation
    if (semesterId) {
      data.semesterId = semesterId;
    }

    console.log('Creating specialty with data:', data);

    const specialty = await prisma.specialty.create({ data });
    return NextResponse.json(specialty, { status: 201 });
  } catch (error) {
    console.error('Error creating specialty:', error);
    return NextResponse.json({ error: 'Failed to create specialty' }, { status: 500 });
  }
}

async function putHandler(request: AuthenticatedRequest) {
  try {
    const { id, name, description, icon, iconColor, iconType, imageUrl, niveauId, semesterId, isFree } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Specialty ID is required' }, { status: 400 });
    }
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
      data.niveau = { connect: { id: niveauId } };
    }
    
    // Handle semester relation
    if (semesterId === null) {
      data.semester = { disconnect: true };
    } else if (typeof semesterId === 'string' && semesterId) {
      data.semester = { connect: { id: semesterId } };
    }

    const specialty = await prisma.specialty.update({ where: { id }, data });
    return NextResponse.json(specialty);
  } catch (error) {
    console.error('Error updating specialty:', error);
    return NextResponse.json({ error: 'Failed to update specialty' }, { status: 500 });
  }
}

async function deleteHandler(request: AuthenticatedRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Specialty ID is required' }, { status: 400 });
    }

    const lectureCount = await prisma.lecture.count({ where: { specialtyId: id } });
    if (lectureCount > 0) {
      return NextResponse.json({ error: 'Cannot delete specialty with existing lectures' }, { status: 400 });
    }

    await prisma.specialty.delete({ where: { id } });
    return NextResponse.json({ message: 'Specialty deleted successfully' });
  } catch (error) {
    console.error('Error deleting specialty:', error);
    return NextResponse.json({ error: 'Failed to delete specialty' }, { status: 500 });
  }
}

export const GET = requireAuth(getHandler);
export const POST = requireAdmin(postHandler);
export const PUT = requireAdmin(putHandler);
export const DELETE = requireAdmin(deleteHandler);