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
      }
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Check permissions
    if (authReq.user.role !== 'admin' && job.userId !== authReq.user.userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Mock preview data structure - in a real implementation, this would come from job processing
    const mockExplanations = [
      {
        id: '1',
        sheet: 'QCM',
        rowNumber: 2,
        questionText: 'Quelle est la cause la plus fréquente d\'hypertension artérielle?',
        optionExplanations: [
          'Option A: L\'hypertension essentielle représente 90-95% des cas...',
          'Option B: Les causes rénales sont moins fréquentes...',
        ],
        hasAiAnalysis: true,
      },
      {
        id: '2',
        sheet: 'QROC',
        rowNumber: 5,
        questionText: 'Citez les principales complications de l\'infarctus du myocarde.',
        optionExplanations: [
          'Réponse: Arythmies, insuffisance cardiaque, rupture myocardique...'
        ],
        hasAiAnalysis: true,
      }
    ];

    const summary = {
      totalExplanations: job.processedItems || 0,
      validExplanations: Math.floor((job.processedItems || 0) * 0.95),
      questionsWithAI: Math.floor((job.processedItems || 0) * 0.8),
      questionsWithoutAI: Math.floor((job.processedItems || 0) * 0.2),
      warnings: job.status === 'failed' ? ['Erreur de traitement détectée'] : [],
    };

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

    return NextResponse.json({
      explanations: mockExplanations.slice(0, Math.min(10, job.processedItems || 0)),
      summary,
      progressInfo,
    });

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