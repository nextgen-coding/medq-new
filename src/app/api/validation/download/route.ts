import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-middleware';
import { getValidationFiles } from '@/lib/validation-file-store';

export async function GET(request: NextRequest) {
  try {
    const authReq = await authenticateRequest(request);
    if (!authReq?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin permission
    if (authReq.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'good', 'error', or 'report'
    const sessionId = searchParams.get('session');

    if (!type || !sessionId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

  // Get files from shared storage
  const fileData = getValidationFiles(sessionId);
    if (!fileData) {
      return NextResponse.json({ error: 'Session not found or expired' }, { status: 404 });
    }

    let buffer: Buffer;
    let fileName: string;
    let contentType: string;

    switch (type) {
      case 'good':
        buffer = fileData.goodFileBuffer;
        fileName = `good_records_${fileData.fileName}`;
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        break;
      case 'error':
        buffer = fileData.errorFileBuffer;
        fileName = `error_records_${fileData.fileName}`;
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        break;
      case 'report':
        buffer = fileData.reportBuffer;
        fileName = `validation_report_${fileData.fileName.replace(/\.[^/.]+$/, '')}.txt`;
        contentType = 'text/plain';
        break;
      default:
        return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }

    // Ensure body type is acceptable (Uint8Array is fine)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': buffer.length.toString(),
      },
    });

  } catch (error) {
    console.error('Error downloading validation file:', error);
    return NextResponse.json(
      { error: 'Download failed' },
      { status: 500 }
    );
  }
}

// Storage helpers moved to src/lib/validation-file-store.ts