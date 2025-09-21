import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { verifyAuth } from '../../../../lib/auth-middleware';

export async function PUT(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { name, sexe, niveauId, semesterId, faculty, image, highlightColor, email } = await request.json();

    // Validate input
    if (!name || !sexe || !niveauId) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate sexe
    if (!['M', 'F'].includes(sexe)) {
      return NextResponse.json(
        { error: 'Invalid gender value' },
        { status: 400 }
      );
    }

    // Verify niveau exists
    const niveau = await prisma.niveau.findUnique({ where: { id: niveauId } });

    if (!niveau) {
      return NextResponse.json({ error: 'Invalid niveau selected' }, { status: 400 });
    }

    // If semesterId is provided, validate it belongs to the chosen niveau
    let validSemesterId: string | null = null;
    if (semesterId) {
      const semester = await prisma.semester.findFirst({ where: { id: semesterId, niveauId } });
      if (!semester) {
        return NextResponse.json({ error: 'Invalid semester for selected level' }, { status: 400 });
      }
      validSemesterId = semester.id;
    }

    // Get current user to check for niveau change
    const currentUser = await prisma.user.findUnique({
      where: { id: authResult.userId },
      select: { niveauId: true, name: true, email: true },
    });

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: { id: authResult.userId },
      data: {
        name,
        email: email ?? undefined,
        sexe,
        niveauId,
        semesterId: validSemesterId, // null if not provided or no semesters
        faculty: faculty ?? null,
        image: image ?? undefined,
        highlightColor: highlightColor ?? undefined,
        profileCompleted: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        sexe: true,
        role: true,
        niveauId: true,
        niveau: true,
        semesterId: true,
        faculty: true,
        image: true,
        highlightColor: true,
        profileCompleted: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Notify admins if niveau changed
    if (currentUser && currentUser.niveauId !== niveauId) {
      const oldNiveau = currentUser.niveauId ? await prisma.niveau.findUnique({
        where: { id: currentUser.niveauId },
        select: { name: true },
      }) : null;

      const newNiveau = await prisma.niveau.findUnique({
        where: { id: niveauId },
        select: { name: true },
      });

      await prisma.notification.create({
        data: {
          title: 'Changement de niveau utilisateur',
          message: `${currentUser.name || currentUser.email} a changé de niveau de "${oldNiveau?.name || 'Aucun'}" à "${newNiveau?.name || 'Aucun'}".\n[USER_ID:${authResult.userId}]`,
          type: 'info',
          category: 'system',
          isAdminNotification: true,
        },
      });
    }

    // Remove sensitive data
    const userWithoutSensitiveData = {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      sexe: updatedUser.sexe,
      role: updatedUser.role,
      niveauId: updatedUser.niveauId,
      niveau: updatedUser.niveau,
      semesterId: updatedUser.semesterId ?? null,
      faculty: updatedUser.faculty ?? null,
      image: updatedUser.image ?? null,
      highlightColor: updatedUser.highlightColor ?? null,
      profileCompleted: updatedUser.profileCompleted,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt
    };

    return NextResponse.json({
      user: userWithoutSensitiveData,
      message: 'Profile updated successfully',
    });

  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}