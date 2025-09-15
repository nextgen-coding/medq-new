import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/comments - Get comments for a lecture
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const lectureId = searchParams.get('lectureId')

    if (!lectureId) {
      return NextResponse.json({ error: 'Lecture ID is required' }, { status: 400 })
    }

    // Verify lecture exists
    const lectureExists = await prisma.lecture.findUnique({
      where: { id: lectureId },
      select: { id: true }
    })

    if (!lectureExists) {
      return NextResponse.json({ error: 'Lecture not found' }, { status: 404 })
    }

    // Fetch all comments for the lecture (single query) then build a tree for unlimited nesting
    const flat = await (prisma as any).comment.findMany({
      where: { lectureId },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, name: true, email: true, role: true } } }
    });

    const byId: Record<string, any> = {};
    (flat as any[]).forEach((c: any) => { byId[c.id] = { ...c, replies: [] }; });
    const roots: any[] = [];
    (flat as any[]).forEach((c: any) => {
      if (c.parentCommentId) {
        const parent = byId[c.parentCommentId];
        if (parent) parent.replies.push(byId[c.id]);
      } else {
        roots.push(byId[c.id]);
      }
    });
    // Order roots newest first, replies oldest first already (asc above)
    roots.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return NextResponse.json(roots)
  } catch (error) {
    console.error('Error fetching comments:', error)
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 })
  }
}

// POST /api/comments - Create a new comment
export async function POST(request: NextRequest) {
  try {
    const { lectureId, userId, content, isAnonymous = false, parentCommentId, imageUrls = [] } = await request.json()

    if (!lectureId || !userId || (!content && (!imageUrls || imageUrls.length === 0))) {
      return NextResponse.json({ error: 'Lecture ID, user ID, and content or images are required' }, { status: 400 })
    }

    // Verify the lecture exists
    const lectureExists = await prisma.lecture.findUnique({
      where: { id: lectureId },
      select: { id: true }
    })

    if (!lectureExists) {
      return NextResponse.json({ error: 'Lecture not found' }, { status: 404 })
    }

    // Verify the user exists
    const userExists = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true }
    })

    if (!userExists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // If parentCommentId provided ensure it exists and belongs to same lecture (allow unlimited nesting)
    if (parentCommentId) {
      const parent = await prisma.comment.findUnique({ where: { id: parentCommentId }, select: { id: true, lectureId: true } })
      if (!parent || parent.lectureId !== lectureId) {
        return NextResponse.json({ error: 'Invalid parent comment' }, { status: 400 })
      }
    }

    const created = await (prisma as any).comment.create({
      data: {
        lectureId,
        userId,
        content: content?.trim() || '',
        isAnonymous: !!isAnonymous,
        imageUrls: imageUrls || [],
        parentCommentId: parentCommentId || null,
      },
      include: { user: { select: { id: true, name: true, email: true, role: true } } }
    });

    const comment = { ...created, replies: [], _count: { likes: 0 } };

    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    console.error('Error creating comment:', error)
    return NextResponse.json({ error: 'Database error or internal server error' }, { status: 500 })
  }
}
