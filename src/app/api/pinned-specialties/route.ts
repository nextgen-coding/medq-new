import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/pinned-specialties - Get user's pinned specialties
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const pinnedSpecialties = await prisma.pinnedSpecialty.findMany({
      where: {
        userId,
      },
      include: {
        specialty: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(pinnedSpecialties)
  } catch (error) {
    console.error('Error fetching pinned specialties:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/pinned-specialties - Pin a specialty
export async function POST(request: NextRequest) {
  try {
    const { userId, specialtyId } = await request.json()

    if (!userId || !specialtyId) {
      return NextResponse.json({ error: 'User ID and specialty ID are required' }, { status: 400 })
    }

    const pinnedSpecialty = await prisma.pinnedSpecialty.create({
      data: {
        userId,
        specialtyId,
      },
      include: {
        specialty: true,
      },
    })

    return NextResponse.json(pinnedSpecialty, { status: 201 })
  } catch (error) {
    console.error('Error pinning specialty:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/pinned-specialties - Unpin a specialty
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const specialtyId = searchParams.get('specialtyId')

    if (!userId || !specialtyId) {
      return NextResponse.json({ error: 'User ID and specialty ID are required' }, { status: 400 })
    }

    await prisma.pinnedSpecialty.deleteMany({
      where: {
        userId,
        specialtyId,
      },
    })

    return NextResponse.json({ message: 'Specialty unpinned successfully' })
  } catch (error) {
    console.error('Error unpinning specialty:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
