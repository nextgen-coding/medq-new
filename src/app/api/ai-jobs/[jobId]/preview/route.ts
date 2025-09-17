import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth-middleware';
import * as XLSX from 'xlsx';

export async function GET(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const authReq = await authenticateRequest(request);
    if (!authReq?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { jobId } = await params;

    const job = await prisma.aiValidationJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        userId: true,
        status: true,
        progress: true,
        message: true,
        processedItems: true,
        totalItems: true,
        currentBatch: true,
        totalBatches: true,
        createdAt: true,
        startedAt: true,
        completedAt: true,
        config: true,
        outputUrl: true,
      }
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Check permissions
    if (authReq.user.role !== 'admin' && job.userId !== authReq.user.userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    let explanations: any[] = [];
    let summary = {
      totalExplanations: job.processedItems || 0,
      validExplanations: 0,
      questionsWithAI: 0,
      questionsWithoutAI: 0,
      warnings: job.status === 'failed' ? ['Erreur de traitement détectée'] : [] as string[],
    };

    // If we have an output workbook, parse real error rows to surface a preview
    if (job.outputUrl && job.outputUrl.startsWith('data:')) {
      try {
        const base64 = job.outputUrl.substring(job.outputUrl.indexOf(',') + 1);
        const buf = Buffer.from(base64, 'base64');
        const wb = XLSX.read(buf, { type: 'buffer' });
        const errWs = wb.Sheets['Erreurs'];
        if (errWs) {
          const rows = XLSX.utils.sheet_to_json<Record<string, any>>(errWs, { defval: '' });
          explanations = rows.slice(0, 10).map((r, i) => ({
            id: String(i + 1),
            sheet: r.sheet || 'unknown',
            rowNumber: r.row || 0,
            questionText: r.question || '',
            reason: r.reason || '',
            hasAiAnalysis: false,
          }));
          summary.totalExplanations = rows.length;
          summary.questionsWithoutAI = rows.length;
        }
      } catch (e) {
        summary.warnings.push('Impossible de parser le fichier de sortie');
      }
    }

    const progressInfo = job.status === 'processing' ? {
      progress: job.progress || 0,
      message: job.message || 'Traitement en cours...',
      processedItems: job.processedItems || 0,
      totalItems: job.totalItems || 0,
      currentBatch: job.currentBatch || 1,
      totalBatches: job.totalBatches || 1,
      estimatedTimeRemaining: calculateETA(job),
      isProcessing: true,
      startTime: job.startedAt?.getTime() || Date.now(),
      lastUpdateTime: Date.now(),
    } : undefined;

    return NextResponse.json({ explanations, summary, progressInfo });

  } catch (error) {
    console.error('Error fetching job preview:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function calculateETA(job: any): number {
  if (!job.startedAt || !job.processedItems || !job.totalItems) {
    return 0;
  }

  const elapsed = Date.now() - job.startedAt.getTime();
  const itemsPerMs = job.processedItems / elapsed;
  const remainingItems = job.totalItems - job.processedItems;
  
  return remainingItems / itemsPerMs;
}