import { NextResponse } from 'next/server';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';

async function handler(request: AuthenticatedRequest) {
  try {
    const { phone } = await request.json();
    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }
    // Optionally: validate phone format here
    try {
      const user = await prisma.user.update({
        where: { id: request.user?.userId },
        data: { phone },
      });
      return NextResponse.json({ success: true, phone: user.phone });
    } catch (err) {
      console.error('Prisma update error:', err, 'userId:', request.user?.userId, 'phone:', phone);
      return NextResponse.json({ error: 'Failed to update phone number', details: String(err) }, { status: 500 });
    }
  } catch (error) {
    console.error('Handler error:', error);
    return NextResponse.json({ error: 'Failed to update phone number', details: String(error) }, { status: 500 });
  }
}

export const PATCH = requireAuth(handler);
