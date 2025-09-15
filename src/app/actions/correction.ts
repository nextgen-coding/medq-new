"use server";

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { SessionCorrectionData, SessionCorrectionSubmission } from '@/types';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    
    if (!token) {
      return null;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string; role: string };
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        hasActiveSubscription: true,
        subscriptionExpiresAt: true
      }
    });

    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

export async function saveCorrection(sessionId: string, data: SessionCorrectionData) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    // Check if user has permission to edit corrections (admin/maintainer)
    if (!['admin', 'maintainer'].includes(user.role.toLowerCase())) {
      throw new Error('Insufficient permissions');
    }

    // Save or update correction data
    const correction = await prisma.sessionCorrection.upsert({
      where: { sessionId },
      update: {
        data: data as any,
        updatedAt: new Date(),
      },
      create: {
        sessionId,
        data: data as any,
        createdBy: user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    revalidatePath(`/session/${sessionId}`);
    
    return { 
      success: true, 
      correction: {
        id: correction.id,
        sessionId: correction.sessionId,
        data: correction.data as SessionCorrectionData,
        createdBy: correction.createdBy,
        createdAt: correction.createdAt,
        updatedAt: correction.updatedAt,
      }
    };
  } catch (error) {
    console.error('Error saving correction:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to save correction' 
    };
  }
}

export async function saveSubmission(sessionId: string, answers: SessionCorrectionSubmission['answers']) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    // Save or update user submission
    const submission = await prisma.sessionCorrectionSubmission.upsert({
      where: {
        sessionId_userId: {
          sessionId,
          userId: user.id,
        },
      },
      update: {
        answers: answers as any,
        updatedAt: new Date(),
      },
      create: {
        sessionId,
        userId: user.id,
        answers: answers as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    revalidatePath(`/session/${sessionId}`);
    
    return { 
      success: true, 
      submission: {
        id: submission.id,
        sessionId: submission.sessionId,
        userId: submission.userId,
        answers: submission.answers as SessionCorrectionSubmission['answers'],
        score: submission.score,
        createdAt: submission.createdAt,
        updatedAt: submission.updatedAt,
      }
    };
  } catch (error) {
    console.error('Error saving submission:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to save submission' 
    };
  }
}

export async function getCorrection(sessionId: string, withSubmission = false) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    // Get correction data
    const correction = await prisma.sessionCorrection.findUnique({
      where: { sessionId },
    });

    let submission = null;
    if (withSubmission) {
      // Get user's submission
      submission = await prisma.sessionCorrectionSubmission.findUnique({
        where: {
          sessionId_userId: {
            sessionId,
            userId: user.id,
          },
        },
      });
    }

    return { 
      success: true, 
      correction: correction ? {
        id: correction.id,
        sessionId: correction.sessionId,
        data: correction.data as SessionCorrectionData,
        createdBy: correction.createdBy,
        createdAt: correction.createdAt,
        updatedAt: correction.updatedAt,
      } : null,
      submission: submission ? {
        id: submission.id,
        sessionId: submission.sessionId,
        userId: submission.userId,
        answers: submission.answers as SessionCorrectionSubmission['answers'],
        score: submission.score,
        createdAt: submission.createdAt,
        updatedAt: submission.updatedAt,
      } : null
    };
  } catch (error) {
    console.error('Error getting correction:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to get correction' 
    };
  }
}

export async function deleteCorrection(sessionId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    // Check if user has permission to delete corrections (admin/maintainer)
    if (!['admin', 'maintainer'].includes(user.role.toLowerCase())) {
      throw new Error('Insufficient permissions');
    }

    // Delete correction and all related submissions
    await prisma.sessionCorrection.delete({
      where: { sessionId },
    });

    revalidatePath(`/session/${sessionId}`);
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting correction:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to delete correction' 
    };
  }
}
