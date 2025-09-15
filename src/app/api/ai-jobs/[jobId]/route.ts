import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth-middleware';

export async function GET(request: NextRequest, { params }: { params: { jobId: string } }) {
  try {
    const authReq = await authenticateRequest(request);
    if (!authReq?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { jobId } = params;

    const job = await prisma.aiValidationJob.findUnique({
      where: { id: jobId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      }
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Check permissions - users can only see their own jobs unless admin
    if (authReq.user.role !== 'admin' && job.userId !== authReq.user.userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({
      id: job.id,
      fileName: job.fileName,
      originalFileName: job.originalFileName,
      status: job.status,
      progress: job.progress,
      message: job.message,
      errorMessage: job.errorMessage,
      processedItems: job.processedItems,
      totalItems: job.totalItems,
      currentBatch: job.currentBatch,
      totalBatches: job.totalBatches,
      ragAppliedCount: job.ragAppliedCount,
      fixedCount: job.fixedCount,
      successfulAnalyses: job.successfulAnalyses,
      failedAnalyses: job.failedAnalyses,
      createdAt: job.createdAt.toISOString(),
      startedAt: job.startedAt?.toISOString(),
      completedAt: job.completedAt?.toISOString(),
      instructions: job.instructions,
      user: job.user,
    });

  } catch (error) {
    console.error('Error fetching AI job:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { jobId: string } }) {
  try {
    const authReq = await authenticateRequest(request);
    if (!authReq?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { jobId } = params;

    const job = await prisma.aiValidationJob.findUnique({
      where: { id: jobId },
      select: { userId: true, status: true }
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Check permissions - users can only delete their own jobs unless admin
    if (authReq.user.role !== 'admin' && job.userId !== authReq.user.userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Don't allow deletion of running jobs
    if (job.status === 'processing') {
      return NextResponse.json({ 
        error: 'Cannot delete a job that is currently processing' 
      }, { status: 400 });
    }

    await prisma.aiValidationJob.delete({
      where: { id: jobId }
    });

    return NextResponse.json({ message: 'Job deleted successfully' });

  } catch (error) {
    console.error('Error deleting AI job:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}