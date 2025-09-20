import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// DELETE /api/course-groups/[id] - Delete a course group
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Delete the course group (this will also delete lecture groups due to cascade)
    await prisma.courseGroup.delete({
      where: {
        id,
      },
    })

    return NextResponse.json({ message: 'Course group deleted successfully' })
  } catch (error) {
    console.error('Error deleting course group:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/course-groups/[id] - Update a course group
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { name, coefficient } = await request.json()

    if (!name && (coefficient === undefined || coefficient === null)) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const data: any = {}
    if (name) data.name = name
    if (typeof coefficient === 'number' && !isNaN(coefficient)) data.coefficient = coefficient

    const updatedGroup = await prisma.courseGroup.update({
      where: {
        id,
      },
      data,
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

    return NextResponse.json(updatedGroup)
  } catch (error) {
    console.error('Error updating course group:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
