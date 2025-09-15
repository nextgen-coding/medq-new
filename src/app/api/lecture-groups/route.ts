import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST /api/lecture-groups - Assign lecture to a group
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { lectureId, lectureIds, courseGroupId } = body as {
      lectureId?: string
      lectureIds?: string[]
      courseGroupId?: string
    }

    if (!courseGroupId) {
      return NextResponse.json({ error: 'Course group ID is required' }, { status: 400 })
    }

    // Bulk assignment
    if (Array.isArray(lectureIds) && lectureIds.length > 0) {
      await prisma.$transaction([
        prisma.lectureGroup.deleteMany({ where: { lectureId: { in: lectureIds } } }),
        prisma.lectureGroup.createMany({
          data: lectureIds.map((id) => ({ lectureId: id, courseGroupId })),
          skipDuplicates: true,
        }),
      ])

      return NextResponse.json({ assignedCount: lectureIds.length }, { status: 201 })
    }

    // Single assignment
    if (!lectureId) {
      return NextResponse.json({ error: 'Lecture ID is required' }, { status: 400 })
    }

    await prisma.lectureGroup.deleteMany({ where: { lectureId } })

    const lectureGroup = await prisma.lectureGroup.create({
      data: { lectureId, courseGroupId },
      include: { lecture: true, courseGroup: true },
    })

    return NextResponse.json(lectureGroup, { status: 201 })
  } catch (error) {
    console.error('Error assigning lecture to group:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/lecture-groups - Remove lecture from group
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    let lectureId = searchParams.get('lectureId')

    // Also support JSON body payload for DELETE
    if (!lectureId) {
      try {
        const body = await request.json()
        lectureId = body?.lectureId
      } catch {
        // ignore body parse errors
      }
    }

    if (!lectureId) {
      return NextResponse.json({ error: 'Lecture ID is required' }, { status: 400 })
    }

    await prisma.lectureGroup.deleteMany({ where: { lectureId } })

    return NextResponse.json({ message: 'Lecture removed from group successfully' })
  } catch (error) {
    console.error('Error removing lecture from group:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
