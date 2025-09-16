import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { processAiValidationJob } from '@/lib/ai/aiValidationProcessor';
import { authenticateRequest } from '@/lib/auth-middleware';

export async function POST(request: NextRequest) {
  try {
    const authReq = await authenticateRequest(request);
    if (!authReq?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin permission
    if (authReq.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const instructions = formData.get('instructions') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];

    if (!allowedTypes.includes(file.type) && 
        !file.name.toLowerCase().endsWith('.xlsx') && 
        !file.name.toLowerCase().endsWith('.xls') && 
        !file.name.toLowerCase().endsWith('.csv')) {
      return NextResponse.json({ 
        error: 'Invalid file type. Only Excel (.xlsx, .xls) and CSV files are allowed.' 
      }, { status: 400 });
    }

    // Validate file size (50MB max)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return NextResponse.json({ 
        error: 'File too large. Maximum size is 50MB.' 
      }, { status: 400 });
    }

    // Create AI validation job
    const job = await prisma.aiValidationJob.create({
      data: {
        fileName: file.name,
        originalFileName: file.name,
        fileSize: file.size,
        fileUrl: null, // Will be set after file upload
        status: 'queued',
        progress: 0,
        message: 'Job queued for processing',
        totalItems: 0,
        processedItems: 0,
        currentBatch: 1,
        totalBatches: 1,
        userId: authReq.user.userId,
        instructions: instructions || null,
        config: {
          aiModel: 'gpt-4',
          maxRetries: 3,
          batchSize: 40,
          qualityThreshold: 0.8
        }
      }
    });

    // Start processing immediately (synchronously kick off but don't block response)
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    // Fire and forget - start real AI processing
    processAiValidationJob(job.id, bytes, instructions).catch((err) => {
      console.error('AI processing error:', err);
    });

    return NextResponse.json({
      id: job.id,
      status: job.status,
      message: 'AI validation job created successfully',
      estimatedDuration: 'quelques minutes selon la taille',
    });

  } catch (error) {
    console.error('AI validation job creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error during job creation' },
      { status: 500 }
    );
  }
}

// Note: previous simulateJobProcessing removed in favor of real processing skeleton