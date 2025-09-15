import { NextRequest, NextResponse } from 'next/server';
import { UTApi } from 'uploadthing/server';

// Initialize UploadThing API only if token is available
const UPLOADTHING_TOKEN = process.env.UPLOADTHING_TOKEN;

export async function POST(request: NextRequest) {
  try {
    console.log('Upload image endpoint called');
    
    // Check if UploadThing is configured
    if (!UPLOADTHING_TOKEN) {
      console.error('UPLOADTHING_TOKEN not configured');
      return NextResponse.json(
        { error: 'Upload service not configured', success: false },
        { status: 500 }
      );
    }

    const utapi = new UTApi({ token: UPLOADTHING_TOKEN });
    
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      console.error('No file provided in request');
      return NextResponse.json(
        { error: 'No file provided', success: false },
        { status: 400 }
      );
    }

    console.log('File received:', { name: file.name, type: file.type, size: file.size });

    // Validate file type
    if (!file.type.startsWith('image/')) {
      console.error('Invalid file type:', file.type);
      return NextResponse.json(
        { error: 'Only image files are allowed', success: false },
        { status: 400 }
      );
    }

    // Validate file size (4MB max)
    const maxSize = 4 * 1024 * 1024; // 4MB
    if (file.size > maxSize) {
      console.error('File too large:', file.size);
      return NextResponse.json(
        { error: 'File size too large. Maximum size is 4MB.', success: false },
        { status: 400 }
      );
    }

    try {
      console.log('Attempting UploadThing upload...');
      // Upload to UploadThing
      const response = await utapi.uploadFiles([file]);
      
      console.log('UploadThing response:', response);
      
      if (response && response.length > 0 && response[0]?.data?.url) {
        console.log('Upload successful:', response[0].data.url);
        return NextResponse.json({ 
          url: response[0].data.url,
          success: true 
        });
      } else {
        console.error('Upload failed - no URL returned:', response);
        throw new Error('Upload failed - no URL returned');
      }
    } catch (uploadError) {
      console.error('UploadThing upload failed:', uploadError);
      console.error('UploadThing upload failed:', uploadError);
      
      // Fallback: convert to base64 data URI for small images
      if (file.size <= 100 * 1024) { // 100KB limit for base64
        console.log('Using base64 fallback for small image');
        const arrayBuffer = await file.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const dataUri = `data:${file.type};base64,${base64}`;
        
        return NextResponse.json({ 
          url: dataUri,
          success: true,
          fallback: true 
        });
      }
      
      // If file is too large for base64, return the upload error
      throw new Error(`Upload failed: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Image upload error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Upload failed',
        success: false 
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Image upload endpoint is working',
    uploadthing_configured: !!UPLOADTHING_TOKEN,
    timestamp: new Date().toISOString()
  });
}
