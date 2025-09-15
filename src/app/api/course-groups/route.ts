import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/course-groups - Get all course groups for a specialty
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const specialtyId = searchParams.get('specialtyId')

    if (!specialtyId) {
      return NextResponse.json({ error: 'Specialty ID is required' }, { status: 400 })
    }

    const courseGroups = await prisma.courseGroup.findMany({
      where: {
        specialtyId,
      },
      include: {
        lectureGroups: {
          include: {
            lecture: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    return NextResponse.json(courseGroups)
  } catch (error) {
    console.error('Error fetching course groups:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/course-groups - Create a new course group
export async function POST(request: NextRequest) {
  try {
    const { name, specialtyId, userId } = await request.json()

    if (!name || !specialtyId || !userId) {
      return NextResponse.json({ error: 'Name, specialty ID, and user ID are required' }, { status: 400 })
    }

    // Check if group name already exists for this specialty
    const existingGroup = await prisma.courseGroup.findFirst({
      where: {
        name,
        specialtyId,
      },
    })

    if (existingGroup) {
      return NextResponse.json({ error: 'Group name already exists for this specialty' }, { status: 400 })
    }

    const courseGroup = await prisma.courseGroup.create({
      data: {
        name,
        specialtyId,
        createdBy: userId,
      },
      include: {
        lectureGroups: {
          include: {
            lecture: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json(courseGroup, { status: 201 })
  } catch (error) {
    console.error('Error creating course group:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
