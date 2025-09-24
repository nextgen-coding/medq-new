import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Shared select for clinical case comments
const fullSelect = {
  id: true,
  content: true,
  isAnonymous: true,
  createdAt: true,
  updatedAt: true,
  parentCommentId: true,
  imageUrls: true,
  user: { select: { id: true, name: true, email: true, role: true, image: true } },
};

// GET /api/clinical-case-comments?questionId=...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const questionId = searchParams.get('questionId');
    if (!questionId) return NextResponse.json({ error: 'Question ID is required' }, { status: 400 });

    const flat = await prisma.clinicalCaseComment.findMany({
      where: { questionId },
      orderBy: { createdAt: 'asc' },
      select: fullSelect,
    });

    const byId: Record<string, any> = {};
    flat.forEach((c: any) => { byId[c.id] = { ...c, replies: [] }; });
    const roots: any[] = [];
    flat.forEach((c: any) => {
      if (c.parentCommentId) {
        const parent = byId[c.parentCommentId];
        if (parent) parent.replies.push(byId[c.id]);
      } else roots.push(byId[c.id]);
    });
    roots.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return NextResponse.json(roots);
  } catch (e) {
    console.error('Error fetching clinical case comments:', e);
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
  }
}

// POST /api/clinical-case-comments
export async function POST(request: NextRequest) {
  try {
    const { questionId, userId, content, isAnonymous, parentCommentId, imageUrls } = await request.json();
    if (!questionId || !userId) return NextResponse.json({ error: 'questionId and userId are required' }, { status: 400 });

    const sanitizedImages = Array.isArray(imageUrls)
      ? imageUrls
          .filter((u: any) => typeof u === 'string')
          .filter((u: string) => {
            // Allow either hosted URL (http/https) or small inline data URL (< ~150KB)
            if (u.startsWith('data:image/')) return u.length < 200000; // rough cap
            return /^https?:\/\//i.test(u) || u.startsWith('/');
          })
          .slice(0,6)
      : [];

    const textContent = typeof content === 'string' ? content : '';
    if (!textContent.trim() && sanitizedImages.length === 0) {
      return NextResponse.json({ error: 'Empty comment' }, { status: 400 });
    }

    // Validate user exists
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    if (parentCommentId) {
      // Validate parent belongs to same question
      // @ts-ignore
      const parent = await (prisma as any).clinicalCaseComment.findUnique({ where: { id: parentCommentId }, select: { id: true, questionId: true } });
      if (!parent || parent.questionId !== questionId) return NextResponse.json({ error: 'Invalid parent comment' }, { status: 400 });
    }

    // @ts-ignore
    const created = await (prisma as any).clinicalCaseComment.create({
      data: {
        questionId,
        userId,
        content: String(textContent).trim(),
        isAnonymous: !!isAnonymous,
        parentCommentId: parentCommentId || null,
        imageUrls: sanitizedImages,
      },
      select: fullSelect,
    });

    return NextResponse.json({ ...created, replies: [] }, { status: 201 });
  } catch (e) {
    console.error('Error creating clinical case comment:', e);
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
  }
}
