import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const niveaux = await prisma.niveau.findMany({
      orderBy: {
        order: 'asc',
      },
    });

    return NextResponse.json(niveaux);
  } catch (error) {
    console.error('Error fetching niveaux:', error);
    return NextResponse.json(
      { error: 'Failed to fetch niveaux' },
      { status: 500 }
    );
  }
} 