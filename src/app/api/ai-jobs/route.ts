import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  try {
    const authReq = await authenticateRequest(request);
    if (!authReq?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const isAdmin = searchParams.get('admin') === 'true';
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '10');

    // Check if user has admin access when requesting admin view
    if (isAdmin && authReq.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Build where clause
    const where: any = {};
    
    // If not admin, only show user's own jobs
    if (!isAdmin) {
      where.userId = authReq.user.userId;
    }

    // Filter by status if provided
    if (status) {
      where.status = status;
    }

    // Fetch jobs with user information
    const jobs = await prisma.aiValidationJob.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: Math.min(limit, 100), // Cap at 100
    });

    return NextResponse.json({
      jobs: jobs.map(job => ({
        id: job.id,
        fileName: job.fileName,
        originalFileName: job.originalFileName,
        status: job.status,
        progress: job.progress,
        message: job.message,
        processedItems: job.processedItems,
        totalItems: job.totalItems,
        currentBatch: job.currentBatch,
        totalBatches: job.totalBatches,
        createdAt: job.createdAt.toISOString(),
        startedAt: job.startedAt?.toISOString(),
        completedAt: job.completedAt?.toISOString(),
        user: job.user,
      }))
    });

  } catch (error) {
    console.error('Error fetching AI jobs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}