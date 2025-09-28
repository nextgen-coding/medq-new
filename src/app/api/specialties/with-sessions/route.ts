import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth-middleware';

export async function GET(request: Request) {
  try {
    // Get user from auth middleware to check subscription status
    const authRequest = await authenticateRequest(request as any);

    if (!authRequest?.user) {
      // If not authenticated, only show free sessions
      const specialties = await prisma.specialty.findMany({
        include: {
          niveau: {
            select: { id: true, name: true }
          },
          semester: {
            select: { id: true, name: true, order: true }
          },
          _count: {
            select: {
              sessions: {
                where: { isFree: true }
              }
            }
          }
        },
        where: {
          sessions: {
            some: { isFree: true }
          }
        },
        orderBy: [
          { niveau: { order: 'asc' } },
          { semester: { order: 'asc' } },
          { name: 'asc' }
        ]
      });

      return NextResponse.json(specialties);
    }

    const { hasActiveSubscription, role } = authRequest.user;

    // If user is admin, show all sessions
    // If user has active subscription, show all sessions
    // If not, only show free sessions
    const sessionWhere = (role === 'admin' || hasActiveSubscription) ? {} : { isFree: true };

    const specialties = await prisma.specialty.findMany({
      include: {
        niveau: {
          select: { id: true, name: true }
        },
        semester: {
          select: { id: true, name: true, order: true }
        },
        _count: {
          select: {
            sessions: {
              where: sessionWhere
            }
          }
        }
      },
      where: {
        sessions: {
          some: sessionWhere
        }
      },
      orderBy: [
        { niveau: { order: 'asc' } },
        { semester: { order: 'asc' } },
        { name: 'asc' }
      ]
    });

    return NextResponse.json(specialties);
  } catch (error) {
    console.error('Error fetching specialties with sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch specialties' },
      { status: 500 }
    );
  }
}
