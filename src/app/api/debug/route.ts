import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Debug endpoint for checking application status
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json(
      { error: 'Debug endpoint failed' },
      { status: 500 }
    );
  }
}