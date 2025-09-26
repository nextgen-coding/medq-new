import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { verifyAuth } from '../../../lib/auth-middleware';

// GET - Fetch level change requests (for admin or user's own requests)
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success || !authResult.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current user info to check role
    const currentUser = await prisma.user.findUnique({
      where: { id: authResult.userId },
      select: { id: true, role: true },
    });

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');

    // If user is admin, they can see all requests or filter by user
    // If user is not admin, they can only see their own requests
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'maintainer';
    
    const where: any = {};
    
    if (!isAdmin) {
      // Non-admin users can only see their own requests
      where.userId = currentUser.id;
    } else if (userId) {
      // Admin filtering by specific user
      where.userId = userId;
    }
    
    if (status) {
      where.status = status;
    }

    // Note: Using any for now since levelChangeRequest might not be in generated types yet
    const requests = await (prisma as any).levelChangeRequest.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        currentLevel: {
          select: {
            id: true,
            name: true,
          },
        },
        requestedLevel: {
          select: {
            id: true,
            name: true,
          },
        },
        reviewedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(requests);
  } catch (error) {
    console.error('Error fetching level change requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch level change requests' },
      { status: 500 }
    );
  }
}

// POST - Create a new level change request
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success || !authResult.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { requestedLevelId, reason } = body;

    if (!requestedLevelId) {
      return NextResponse.json(
        { error: 'Requested level ID is required' },
        { status: 400 }
      );
    }

    // Get the user's current level
    const user = await prisma.user.findUnique({
      where: { id: authResult.userId },
      select: { niveauId: true },
    });

    if (!user?.niveauId) {
      return NextResponse.json(
        { error: 'User must have a current level to request a change' },
        { status: 400 }
      );
    }

    // Check if the requested level exists
    const requestedLevel = await prisma.niveau.findUnique({
      where: { id: requestedLevelId },
    });

    if (!requestedLevel) {
      return NextResponse.json(
        { error: 'Requested level not found' },
        { status: 404 }
      );
    }

    // Check if user already has a pending request
    const existingRequest = await (prisma as any).levelChangeRequest.findFirst({
      where: {
        userId: authResult.userId,
        status: 'pending',
      },
    });

    if (existingRequest) {
      return NextResponse.json(
        { error: 'You already have a pending level change request' },
        { status: 400 }
      );
    }

    // Create the level change request and admin notification in a transaction
    const result = await prisma.$transaction(async (tx: any) => {
      // Create the level change request
      const levelChangeRequest = await tx.levelChangeRequest.create({
        data: {
          userId: authResult.userId,
          currentLevelId: user.niveauId,
          requestedLevelId,
          reason: reason || null,
          status: 'pending',
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          currentLevel: {
            select: {
              id: true,
              name: true,
            },
          },
          requestedLevel: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Create admin notification about new level change request
      await tx.notification.create({
        data: {
          title: 'Nouvelle demande de changement de niveau',
          message: `${levelChangeRequest.user.name || 'Un utilisateur'} (${levelChangeRequest.user.email}) demande un changement de niveau de "${levelChangeRequest.currentLevel.name}" vers "${levelChangeRequest.requestedLevel.name}".${reason ? '\n\nRaison: ' + reason : ''}`,
          type: 'info',
          createdByAdminId: authResult.userId,
          isAdminNotification: true,
          isRead: false,
        },
      });

      return levelChangeRequest;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating level change request:', error);
    return NextResponse.json(
      { error: 'Failed to create level change request' },
      { status: 500 }
    );
  }
}

// PUT - Update level change request (for admin approval/rejection)
export async function PUT(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success || !authResult.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current user info to check role
    const currentUser = await prisma.user.findUnique({
      where: { id: authResult.userId },
      select: { id: true, role: true },
    });

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Only admin users can approve/reject requests
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'maintainer';
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { requestId, status, adminNote } = body;

    if (!requestId || !status) {
      return NextResponse.json(
        { error: 'Request ID and status are required' },
        { status: 400 }
      );
    }

    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json(
        { error: 'Status must be either "approved" or "rejected"' },
        { status: 400 }
      );
    }

    // Find the request
    const request_record = await (prisma as any).levelChangeRequest.findUnique({
      where: { id: requestId },
      include: {
        user: true,
        requestedLevel: true,
      },
    });

    if (!request_record) {
      return NextResponse.json(
        { error: 'Level change request not found' },
        { status: 404 }
      );
    }

    if (request_record.status !== 'pending') {
      return NextResponse.json(
        { error: 'Only pending requests can be updated' },
        { status: 400 }
      );
    }

    // Use a transaction to update the request and potentially the user's level
    const result = await prisma.$transaction(async (tx: any) => {
      // Update the request
      const updatedRequest = await tx.levelChangeRequest.update({
        where: { id: requestId },
        data: {
          status,
          reviewedBy: currentUser.id,
          reviewedAt: new Date(),
          adminNote: adminNote || null,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          currentLevel: {
            select: {
              id: true,
              name: true,
            },
          },
          requestedLevel: {
            select: {
              id: true,
              name: true,
            },
          },
          reviewedByUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      // If approved, update the user's level
      if (status === 'approved') {
        await tx.user.update({
          where: { id: request_record.userId },
          data: {
            niveauId: request_record.requestedLevelId,
          },
        });
      }

      // Create notification for the user about the decision
      const notificationTitle = status === 'approved' 
        ? 'Demande de niveau approuvée' 
        : 'Demande de niveau refusée';
      
      const notificationMessage = status === 'approved'
        ? `Votre demande de changement vers "${request_record.requestedLevel.name}" a été approuvée.${adminNote ? '\n\nNote de l\'administrateur: ' + adminNote : ''}`
        : `Votre demande de changement vers "${request_record.requestedLevel.name}" a été refusée.${adminNote ? '\n\nRaison: ' + adminNote : ''}`;

      await (tx as any).notification.create({
        data: {
          title: notificationTitle,
          message: notificationMessage,
          type: status === 'approved' ? 'success' : 'error',
          userId: request_record.userId,
          createdByAdminId: currentUser.id,
          isRead: false,
        },
      });

      return updatedRequest;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating level change request:', error);
    return NextResponse.json(
      { error: 'Failed to update level change request' },
      { status: 500 }
    );
  }
}
