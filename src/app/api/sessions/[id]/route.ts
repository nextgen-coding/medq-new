import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, AuthenticatedRequest } from '@/lib/auth-middleware'

// GET /api/sessions/[id] - Get a single session by ID
// Note: Using a generic context param (instead of destructured typed params) to satisfy Next.js 15 route handler validation.
export async function GET(
  request: NextRequest,
  context: any
) {
  try {
    const sessionId = context?.params?.id as string | undefined

    if (!sessionId) {
      return NextResponse.json({ error: 'ID de session requis' }, { status: 400 })
    }

  const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        specialty: {
          select: {
            id: true,
            name: true,
            description: true,
            icon: true,
          },
        },
        niveau: {
          select: {
            id: true,
            name: true,
          },
        },
        semester: {
          select: {
            id: true,
            name: true,
            order: true,
          },
        },
      },
    })

    if (!session) {
      return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
    }

    return NextResponse.json(session)
  } catch (error) {
    console.error('Error fetching session:', error)
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}

// DELETE /api/sessions/[id] - Delete a single session (admin only)
export const DELETE = requireAdmin(async (
  request: AuthenticatedRequest,
  context: any
) => {
  try {
    const sessionId = context?.params?.id as string | undefined

    if (!sessionId) {
      return NextResponse.json({ error: 'ID de session requis' }, { status: 400 })
    }

    // Check if session exists
    const existingSession = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true, name: true }
    })

    if (!existingSession) {
      return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
    }

    // Delete the session
    await prisma.session.delete({
      where: { id: sessionId }
    })

    return NextResponse.json({ 
      message: 'Session supprimée avec succès',
      deletedSession: existingSession
    })
  } catch (error) {
    console.error('Error deleting session:', error)
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
})

// PUT /api/sessions/[id] - Update a session (admin only)
export const PUT = requireAdmin(async (
  request: AuthenticatedRequest,
  context: any
) => {
  try {
    const sessionId = context?.params?.id as string | undefined

    if (!sessionId) {
      return NextResponse.json({ error: 'ID de session requis' }, { status: 400 })
    }

    const body = await request.json()
    const { name, pdfUrl, correctionUrl, specialtyId, niveauId, semesterId } = body

    // Validate required fields
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Le nom de la session est requis' }, { status: 400 })
    }

    // Check if session exists
    const existingSession = await prisma.session.findUnique({
      where: { id: sessionId }
    })

    if (!existingSession) {
      return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
    }

    // Validate specialty exists if provided
    if (specialtyId) {
      const specialty = await prisma.specialty.findUnique({
        where: { id: specialtyId }
      })
      if (!specialty) {
        return NextResponse.json({ error: 'Spécialité introuvable' }, { status: 400 })
      }
    }

    // Validate niveau exists if provided
    if (niveauId) {
      const niveau = await prisma.niveau.findUnique({
        where: { id: niveauId }
      })
      if (!niveau) {
        return NextResponse.json({ error: 'Niveau introuvable' }, { status: 400 })
      }
    }

    // Validate semester exists if provided
    if (semesterId) {
      const semester = await prisma.semester.findUnique({
        where: { id: semesterId }
      })
      if (!semester) {
        return NextResponse.json({ error: 'Semestre introuvable' }, { status: 400 })
      }
    }

    // Update the session
    const updatedSession = await prisma.session.update({
      where: { id: sessionId },
      data: {
        name: name.trim(),
        pdfUrl: pdfUrl?.trim() || null,
        correctionUrl: correctionUrl?.trim() || null,
        specialtyId: specialtyId || existingSession.specialtyId,
        niveauId: niveauId || existingSession.niveauId,
        semesterId: semesterId || existingSession.semesterId,
      },
      include: {
        specialty: {
          select: {
            id: true,
            name: true,
            description: true,
            icon: true,
          },
        },
        niveau: {
          select: {
            id: true,
            name: true,
          },
        },
        semester: {
          select: {
            id: true,
            name: true,
            order: true,
          },
        },
      },
    })

    return NextResponse.json(updatedSession)
  } catch (error) {
    console.error('Error updating session:', error)
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
})

// PATCH /api/sessions/[id] - Update a session (admin only) - alias for PUT
export const PATCH = PUT;
