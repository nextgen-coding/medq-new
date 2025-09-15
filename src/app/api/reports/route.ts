import { NextResponse } from 'next/server';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';

async function getHandler(request: AuthenticatedRequest) {
  try {
    const userId = request.user?.userId;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    const { searchParams } = new URL(request.url);
    const lectureId = searchParams.get('lectureId');
    const questionId = searchParams.get('questionId');
  const status = searchParams.get('status');
  const typeParam = searchParams.get('type');

    // Get user with their niveau information
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        id: true, 
        role: true, 
        niveauId: true
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const where: Record<string, unknown> = {};
    if (lectureId) where.lectureId = lectureId;
    if (questionId) where.questionId = questionId;
    if (status) where.status = status;
    if (typeParam) {
      // Accept friendly values and map to new enum values
      const t = typeParam.toLowerCase();
      const map: Record<string, string> = {
        'erreur_de_saisie': 'erreur_de_saisie',
        'erreur de saisie': 'erreur_de_saisie',
        'saisie': 'erreur_de_saisie',
        'typo': 'erreur_de_saisie',
        'question_hors_cours': 'question_hors_cours',
        'question hors cours': 'question_hors_cours',
        'hors_cours': 'question_hors_cours',
        'hors cours': 'question_hors_cours',
        'outofscope': 'question_hors_cours',
        'correction_erronee': 'correction_erronee',
        'correction erronée': 'correction_erronee',
        'correction erronee': 'correction_erronee',
        'erronee': 'correction_erronee',
  'wrong_correction': 'correction_erronee',
  // legacy values (map to new)
  'mal_placee': 'question_hors_cours',
  'mal-placée': 'question_hors_cours',
  'mal placée': 'question_hors_cours',
  'misplaced': 'question_hors_cours',
  'erreur_syntaxe': 'correction_erronee',
  'erreur syntaxe': 'correction_erronee',
  'syntax': 'correction_erronee',
  'autre': 'erreur_de_saisie',
  'other': 'erreur_de_saisie'
      };
      const mapped = map[t] || t;
      (where as any).reportType = mapped;
    }

    // If user is not admin and has a niveau, filter by specialty niveau
    if (user.role !== 'admin' && user.niveauId) {
      where.lecture = {
        specialty: {
          niveauId: user.niveauId
        }
      };
    }

    const reports = await prisma.report.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
  question: {
          select: {
            id: true,
            text: true,
            type: true
          }
        },
        lecture: {
          select: {
            id: true,
            title: true,
            specialty: {
              select: {
                id: true,
                name: true,
                niveauId: true,
                niveau: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            }
          }
        },
  user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });
    
    return NextResponse.json(reports);
  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    );
  }
}

async function postHandler(request: AuthenticatedRequest) {
  try {
  const { questionId, lectureId, message, reportType } = await request.json();
    const userId = request.user?.userId;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!questionId || !lectureId) {
      return NextResponse.json({ error: 'questionId and lectureId are required' }, { status: 400 });
    }

    // Coerce empty / whitespace-only / undefined message to null so DB constraint (if any) passes
    let nullableMessage: string | null = null;
    if (typeof message === 'string') {
      const trimmed = message.trim();
      if (trimmed.length > 0) nullableMessage = trimmed; // keep meaningful text
    }
    let report;
    try {
      report = await (prisma as any).report.create({
        data: {
          questionId,
          lectureId,
          message: nullableMessage, // may be null if DB migrated
          reportType: reportType ?? undefined,
          userId,
          status: 'pending'
        },
        include: {
          question: { select: { id: true, text: true, type: true } },
          lecture: { select: { id: true, title: true } },
          user: { select: { id: true, email: true, name: true } }
        }
      });
    } catch (e: any) {
      // Constraint blocking NULL? Provide minimal placeholder so not blank constraint passes, else rethrow
      if ((e?.code === 'P2011' || e?.code === '23514') && nullableMessage === null) {
        try {
          report = await (prisma as any).report.create({
            data: {
              questionId,
              lectureId,
              message: '-', // minimal placeholder
              reportType: reportType ?? undefined,
              userId,
              status: 'pending'
            },
            include: {
              question: { select: { id: true, text: true, type: true } },
              lecture: { select: { id: true, title: true } },
              user: { select: { id: true, email: true, name: true } }
            }
          });
        } catch (inner) {
          throw inner;
        }
      } else {
        throw e;
      }
    }

    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    console.error('Error creating report:', error);
    return NextResponse.json(
      { error: 'Failed to create report' },
      { status: 500 }
    );
  }
}

export const GET = requireAuth(getHandler);
export const POST = requireAuth(postHandler); 