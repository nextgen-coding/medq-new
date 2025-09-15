import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/comments/like  { commentId, userId }
export async function POST(req: NextRequest) {
  try {
    const { commentId, userId } = await req.json();
    if (!commentId || !userId) {
      return NextResponse.json({ error: 'commentId and userId required' }, { status: 400 });
    }

  // After adding CommentLike model run `prisma generate` so prisma.commentLike is available
  const existing = await (prisma as any).commentLike.findUnique({
      where: { commentId_userId: { commentId, userId } }
    });

    if (existing) {
  await (prisma as any).commentLike.delete({ where: { commentId_userId: { commentId, userId } } });
      return NextResponse.json({ liked: false });
    } else {
  await (prisma as any).commentLike.create({ data: { commentId, userId } });
      return NextResponse.json({ liked: true });
    }
  } catch (e) {
    console.error('Toggle like error', e);
    return NextResponse.json({ error: 'Failed to toggle like' }, { status: 500 });
  }
}
