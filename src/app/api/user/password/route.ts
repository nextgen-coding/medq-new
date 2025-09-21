import { NextResponse } from 'next/server';
import { requireAuth, AuthenticatedRequest } from '../../../../lib/auth-middleware';
import { prisma } from '../../../../lib/prisma';
import bcrypt from 'bcryptjs';
import { validatePassword } from '../../../../lib/password-validation';

async function putHandler(request: AuthenticatedRequest) {
  try {
    const { currentPassword, newPassword } = await request.json();
    
    if (!newPassword) {
      return NextResponse.json(
        { error: 'New password is required' },
        { status: 400 }
      );
    }

    // Validate new password
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        { error: passwordValidation.errors[0] },
        { status: 400 }
      );
    }
    
    const userId = request.user?.userId;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Get current user with password and google_id
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true, google_id: true }
    });
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // If user has an existing password, require current password verification
    if (user.password) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: 'Current password is required' },
          { status: 400 }
        );
      }
      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        return NextResponse.json(
          { error: 'Current password is incorrect' },
          { status: 400 }
        );
      }
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { 
        password: hashedPassword,
        passwordUpdatedAt: new Date()
      }
    });
    
    return NextResponse.json({ 
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Error updating password:', error);
    return NextResponse.json(
      { error: 'Failed to update password' },
      { status: 500 }
    );
  }
}

export const PUT = requireAuth(putHandler); 