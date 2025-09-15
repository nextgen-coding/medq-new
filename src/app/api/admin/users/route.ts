import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, AuthenticatedRequest } from '@/lib/auth-middleware';

async function getHandler(request: AuthenticatedRequest) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const search = (searchParams.get('search') || '').trim();
  const role = searchParams.get('role');

  const where: any = {};
  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (role && ['student', 'maintainer', 'admin'].includes(role)) {
    where.role = role as any;
  }

  const [totalCount, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { progress: true, reports: true }
        }
      }
    })
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  return NextResponse.json({
    users,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  });
}

async function putHandler(request: AuthenticatedRequest) {
  const body = await request.json();
  const { userId, role } = body as { userId: string; role: 'student' | 'maintainer' | 'admin' };
  if (!userId || !role) return NextResponse.json({ error: 'userId and role are required' }, { status: 400 });
  if (!['student', 'maintainer', 'admin'].includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 });

  // Prevent admin from demoting themselves
  if (request.user && request.user.userId === userId && role !== 'admin') {
    return NextResponse.json({ error: 'You cannot remove your own admin role' }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role },
    select: {
      id: true, email: true, name: true, role: true, status: true, createdAt: true, updatedAt: true,
      _count: { select: { progress: true, reports: true } }
    }
  });
  return NextResponse.json(updated);
}

export const GET = requireAdmin(getHandler);
export const PUT = requireAdmin(putHandler);