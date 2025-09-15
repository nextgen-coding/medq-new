import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { questionCommentsSupportsAnonymous } from '@/lib/db-features';

// Shared select for full-feature schema (with isAnonymous & imageUrls)
const fullSelect = {
  id: true,
  content: true,
  isAnonymous: true,
  createdAt: true,
  updatedAt: true,
  parentCommentId: true,
  imageUrls: true,
  user: { select: { id: true, name: true, email: true, role: true } },
};

// GET /api/question-comments?questionId=...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const questionId = searchParams.get('questionId');
    if (!questionId) return NextResponse.json({ error: 'Question ID is required' }, { status: 400 });

    const exists = await prisma.question.findUnique({ where: { id: questionId }, select: { id: true } });
    if (!exists) return NextResponse.json({ error: 'Question not found' }, { status: 404 });

    const supports = await questionCommentsSupportsAnonymous();
    if (supports) {
      // @ts-ignore legacy prisma client typing for new columns
      const flat = await (prisma as any).questionComment.findMany({
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
    }

    // Fallback schema (no is_anonymous / image_urls columns yet)
    const raw = await prisma.$queryRaw<Array<{
      id: string; content: string; created_at: Date; updated_at: Date; parent_comment_id: string | null; user_id: string; question_id: string;
    }>>`SELECT id::text, content, created_at, updated_at, parent_comment_id, user_id, question_id FROM question_comments WHERE question_id = ${questionId}::uuid ORDER BY created_at DESC`;

    // Fetch users (profiles) in one query
    const userIds = [...new Set(raw.map(r => r.user_id))];
    const users = userIds.length ? await prisma.$queryRaw<Array<{ id: string; name: string | null; email: string | null; role: string }>>`SELECT id::text AS id, name, email, role FROM profiles WHERE id = ANY(${userIds}::uuid[])` : [];
    const userMap: Record<string, any> = {};
    users.forEach(u => { userMap[u.id] = u; });

    const mapped = raw.map(r => ({
      id: r.id,
      content: r.content,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      parentCommentId: r.parent_comment_id,
      isAnonymous: false,
      imageUrls: [] as string[],
      replies: [] as any[],
      user: userMap[r.user_id] || { id: r.user_id, name: null, email: null, role: 'student' },
    }));
    return NextResponse.json(mapped);
  } catch (e) {
    console.error('Error fetching question comments:', e);
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
  }
}

// POST /api/question-comments
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

    const [question, user] = await Promise.all([
      prisma.question.findUnique({ where: { id: questionId }, select: { id: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
    ]);
    if (!question) return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const supports = await questionCommentsSupportsAnonymous();
    if (parentCommentId) {
      // Validate parent belongs to same question
      // @ts-ignore
      const parent = await (prisma as any).questionComment.findUnique({ where: { id: parentCommentId }, select: { id: true, questionId: true } });
      if (!parent || parent.questionId !== questionId) return NextResponse.json({ error: 'Invalid parent comment' }, { status: 400 });
    }

    if (supports) {
      // @ts-ignore
      const created = await (prisma as any).questionComment.create({
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
    }

    // Fallback insert (legacy schema) – no anonymous or images support
    const inserted = await prisma.$queryRaw<Array<{ id: string; content: string; created_at: Date; updated_at: Date; parent_comment_id: string | null }>>`
      INSERT INTO question_comments (question_id, user_id, content, parent_comment_id)
  VALUES (${questionId}::uuid, ${userId}::uuid, ${String(textContent).trim()}, ${parentCommentId ? parentCommentId : null}::uuid)
      RETURNING id::text, content, created_at, updated_at, parent_comment_id;
    `;
    const row = inserted?.[0];
    if (!row) throw new Error('Insert failed');
    const userRows = await prisma.$queryRaw<Array<{ id: string; name: string | null; email: string | null; role: string }>>`
      SELECT id::text AS id, name, email, role FROM profiles WHERE id = ${userId}::uuid;
    `;
    const userInfo = userRows?.[0] ?? { id: userId, name: null, email: null, role: 'student' };
    return NextResponse.json({ id: row.id, content: row.content, createdAt: row.created_at, updatedAt: row.updated_at, isAnonymous: false, parentCommentId: row.parent_comment_id, imageUrls: [], replies: [], user: userInfo }, { status: 201 });
  } catch (e) {
    console.error('Error creating question comment:', e);
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
  }
}

