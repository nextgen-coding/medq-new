import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, AuthenticatedRequest } from '@/lib/auth-middleware';

async function getHandler(request: AuthenticatedRequest) {
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').toLowerCase();
  const role = url.searchParams.get('role'); // optional filter

  const where: any = {};
  if (q) {
    where.OR = [
      { email: { contains: q, mode: 'insensitive' } },
      { name: { contains: q, mode: 'insensitive' } },
    ];
  }
  if (role && ['student', 'maintainer', 'admin'].includes(role)) {
    where.role = role as any;
  }

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    }
  });

  return NextResponse.json(users);
}

export const GET = requireAdmin(getHandler);
