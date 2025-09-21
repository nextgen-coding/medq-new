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
  user: { select: { id: true, name: true, email: true, role: true } },
};

// PUT /api/clinical-case-comments/[id]
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { content, imageUrls } = await request.json();

    if (!id) return NextResponse.json({ error: 'Comment ID is required' }, { status: 400 });

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

    // @ts-ignore
    const updated = await (prisma as any).clinicalCaseComment.update({
      where: { id },
      data: {
        content: String(textContent).trim(),
        imageUrls: sanitizedImages,
        updatedAt: new Date(),
      },
      select: fullSelect,
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error('Error updating clinical case comment:', e);
    return NextResponse.json({ error: 'Failed to update comment' }, { status: 500 });
  }
}

// DELETE /api/clinical-case-comments/[id]
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Comment ID is required' }, { status: 400 });

    // @ts-ignore
    const comment = await (prisma as any).clinicalCaseComment.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!comment) return NextResponse.json({ error: 'Comment not found' }, { status: 404 });

    // Check if user owns the comment (basic permission check)
    // In a real app, you'd get userId from auth context
    // For now, we'll allow deletion

    // @ts-ignore
    await (prisma as any).clinicalCaseComment.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Error deleting clinical case comment:', e);
    return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 });
  }
}