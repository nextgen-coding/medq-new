import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth-middleware';

export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const authReq = await authenticateRequest(request);
  if (!authReq?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { jobId } = await params;
  const job = await prisma.aiValidationJob.findUnique({ where: { id: jobId }, select: { userId: true } });
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  if (authReq.user.role !== 'admin' && job.userId !== authReq.user.userId) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (data: any) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      let lastUpdatedAt: number | null = null;

      const interval = setInterval(async () => {
        try {
          const j = await prisma.aiValidationJob.findUnique({ where: { id: jobId } });
          if (!j) {
            clearInterval(interval);
            controller.close();
            return;
          }
          const updatedAt = (j.updatedAt as any)?.getTime?.() ?? Date.now();
          if (lastUpdatedAt === null || updatedAt > lastUpdatedAt) {
            lastUpdatedAt = updatedAt;
            send({
              id: j.id,
              status: j.status,
              progress: j.progress,
              message: j.message,
              processedItems: j.processedItems,
              totalItems: j.totalItems,
              currentBatch: j.currentBatch,
              totalBatches: j.totalBatches,
            });
          }

          if (j.status === 'completed' || j.status === 'failed') {
            clearInterval(interval);
            controller.close();
          }
        } catch (e) {
          clearInterval(interval);
          controller.close();
        }
      }, 1000);

      // Send an initial payload
      const initial = await prisma.aiValidationJob.findUnique({ where: { id: jobId } });
      if (initial) {
        send({
          id: initial.id,
          status: initial.status,
          progress: initial.progress,
          message: initial.message,
          processedItems: initial.processedItems,
          totalItems: initial.totalItems,
          currentBatch: initial.currentBatch,
          totalBatches: initial.totalBatches,
        });
      }
    }
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
