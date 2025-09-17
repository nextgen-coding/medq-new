import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth-middleware';

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
        fileName: true,
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

    // Check if job is completed
    if (job.status !== 'completed') {
      return NextResponse.json({ 
        error: 'Job is not completed yet' 
      }, { status: 400 });
    }

    // If we don't have an outputUrl, that's an error
    if (!job.outputUrl) {
      return NextResponse.json({ 
        error: 'Output file not available' 
      }, { status: 404 });
    }

    // If outputUrl is a data URL, decode and return it
    if (job.outputUrl.startsWith('data:')) {
      const base64 = job.outputUrl.substring(job.outputUrl.indexOf(',') + 1)
      const buf = Buffer.from(base64, 'base64')
      return new NextResponse(buf as any, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="enhanced_${job.fileName}"`,
        },
      })
    }

    // Otherwise, fallback to old mock behavior (temporary)
    const mockExcelData = generateMockExcelFile(job.fileName)
    return new NextResponse(mockExcelData as any, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="enhanced_${job.fileName}"`,
      },
    })

  } catch (error) {
    console.error('Error downloading job result:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function generateMockExcelFile(fileName: string): Buffer {
  // This is a mock implementation
  // In a real system, you would use a library like ExcelJS to generate the actual file
  const mockContent = `Enhanced file for ${fileName}\nThis would contain the AI-enhanced questions with detailed explanations.`;
  return Buffer.from(mockContent, 'utf-8');
}