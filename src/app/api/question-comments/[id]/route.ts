import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth-middleware';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { content, isAnonymous, imageUrls } = await request.json();
    if (!content) return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    // Auth check
    const auth = await authenticateRequest(request);
    if (!auth?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Use raw SQL to fetch owner to avoid selecting missing columns
    const ownerRows = await prisma.$queryRaw<Array<{ user_id: string }>>`
      SELECT user_id::text AS user_id FROM question_comments WHERE id = ${id}::uuid;
    `;
    const ownerId = ownerRows?.[0]?.user_id;
    if (!ownerId) return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    const isAdmin = auth.user.role === 'admin';
    const isOwner = auth.user.userId === ownerId;
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    try {
      // @ts-ignore - model available after prisma generate
      // @ts-ignore - prisma delegate is generated
      // Attempt to update including imageUrls; if column missing, catch below
      let updated: any;
      try {
        // @ts-ignore dynamic optional field
        updated = await (prisma as any).questionComment.update({
          where: { id },
          data: {
            content: String(content).trim(),
            isAnonymous: typeof isAnonymous === 'boolean' ? isAnonymous : undefined,
            // limit to 6 images
            imageUrls: Array.isArray(imageUrls) ? imageUrls.slice(0,6) : undefined,
            updatedAt: new Date()
          },
          select: {
            id: true,
            content: true,
            isAnonymous: true,
            createdAt: true,
            updatedAt: true,
            imageUrls: true,
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        });
      } catch (inner) {
        // Retry without imageUrls if schema not migrated yet
        updated = await prisma.questionComment.update({
          where: { id },
          data: {
            content: String(content).trim(),
            isAnonymous: typeof isAnonymous === 'boolean' ? isAnonymous : undefined,
            updatedAt: new Date()
          },
          select: {
            id: true,
            content: true,
            isAnonymous: true,
            createdAt: true,
            updatedAt: true,
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        });
        (updated as any).imageUrls = [];
      }
      return NextResponse.json(updated);
    } catch (e: any) {
      if (e?.code === 'P2022') {
        // Fallback: column missing, update via raw SQL and return isAnonymous=false
        const result = await prisma.$queryRaw<Array<{ id: string; content: string; created_at: Date; updated_at: Date; user_id: string }>>`
          UPDATE question_comments
          SET content = ${String(content).trim()}, updated_at = now()
          WHERE id = ${id}::uuid
          RETURNING id::text, content, created_at, updated_at, user_id::text as user_id;
        `;
        const row = result?.[0];
        if (!row) return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
        const userRows = await prisma.$queryRaw<Array<{ id: string; name: string | null; email: string | null; role: string }>>`
          SELECT id::text AS id, name, email, role FROM profiles WHERE id = ${row.user_id}::uuid;
        `;
        const userInfo = userRows?.[0] ?? { id: row.user_id, name: null, email: null, role: 'student' };
        return NextResponse.json({
          id: row.id,
          content: row.content,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          isAnonymous: false,
          imageUrls: [],
          user: userInfo,
        });
      }
      throw e;
    }
  } catch (error) {
    console.error('Error updating question comment:', error);
    return NextResponse.json({ error: 'Failed to update comment' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Auth check
    const auth = await authenticateRequest(request);
    if (!auth?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Fetch owner
    const ownerRows = await prisma.$queryRaw<Array<{ user_id: string }>>`
      SELECT user_id::text AS user_id FROM question_comments WHERE id = ${id}::uuid;
    `;
    const ownerId = ownerRows?.[0]?.user_id;
    if (!ownerId) return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    const isAdmin = auth.user.role === 'admin';
    const isOwner = auth.user.userId === ownerId;
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    // Use raw SQL delete to avoid selecting missing column
    const del = await prisma.$queryRaw<Array<{ id: string }>>`
      DELETE FROM question_comments WHERE id = ${id}::uuid RETURNING id::text as id;
    `;
    if (!del?.[0]) return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    return NextResponse.json({ message: 'Deleted' });
  } catch (error) {
    console.error('Error deleting question comment:', error);
    return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 });
  }
}
