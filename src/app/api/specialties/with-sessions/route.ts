import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
  const specialties = await prisma.specialty.findMany({
      include: {
        niveau: {
          select: { id: true, name: true }
        },
        semester: {
          select: { id: true, name: true, order: true }
        },
        _count: {
          select: { sessions: true }
        }
      },
      orderBy: [
        { niveau: { order: 'asc' } },
        { semester: { order: 'asc' } },
        { name: 'asc' }
      ]
    });

    return NextResponse.json(specialties);
  } catch (error) {
    console.error('Error fetching specialties with sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch specialties' },
      { status: 500 }
    );
  }
}
