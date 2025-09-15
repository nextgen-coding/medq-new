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

    // For now, return a mock Excel file response
    // In a real implementation, this would fetch the file from storage
    if (!job.outputUrl) {
      return NextResponse.json({ 
        error: 'Output file not available' 
      }, { status: 404 });
    }

    // Mock Excel file generation
    const mockExcelData = generateMockExcelFile(job.fileName);
    
    return new NextResponse(mockExcelData as any, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="enhanced_${job.fileName}"`,
      },
    });

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