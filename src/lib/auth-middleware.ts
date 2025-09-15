import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma';
import { Prisma } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    userId: string;
    email: string;
    role: string;
    hasActiveSubscription?: boolean;
  };
}

export async function authenticateRequest(request: NextRequest): Promise<AuthenticatedRequest | null> {
  try {
    const token = request.cookies.get('auth-token')?.value || request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return null;

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string; role: string };

    let user;
    try {
      user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          role: true,
          hasActiveSubscription: true,
          subscriptionExpiresAt: true
        }
      });
    } catch (dbErr:any) {
      // Distinguish DB connectivity issue to return 503 instead of misleading 401
      if (dbErr instanceof Prisma.PrismaClientKnownRequestError && dbErr.code === 'P1001') {
        console.error('Database unreachable during auth (P1001).');
        throw new Error('DB_UNAVAILABLE');
      }
      throw dbErr; // propagate
    }

    if (!user) return null;

    const hasActiveSubscription = user.hasActiveSubscription && (!user.subscriptionExpiresAt || new Date(user.subscriptionExpiresAt) > new Date());

    const authenticatedRequest = request as AuthenticatedRequest;
    authenticatedRequest.user = { userId: user.id, email: user.email, role: user.role, hasActiveSubscription };
    return authenticatedRequest;
  } catch (error) {
    if ((error as Error).message === 'DB_UNAVAILABLE') {
      // Bubble up as special null marker with symbol via header usage later
      (request as any)._dbUnavailable = true;
      return null;
    }
    console.error('Authentication error:', error);
    return null;
  }
}

export function requireAuth<T extends any[]>(
  handler: (req: AuthenticatedRequest, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T) => {
    const authenticatedRequest = await authenticateRequest(request);
    if (!authenticatedRequest) {
      if ((request as any)._dbUnavailable) {
        return NextResponse.json({ error: 'Service Unavailable: database unreachable' }, { status: 503 });
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return handler(authenticatedRequest, ...args);
  };
}

export function requireAdmin<T extends any[]>(
  handler: (req: AuthenticatedRequest, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T) => {
    const authenticatedRequest = await authenticateRequest(request);
    if (!authenticatedRequest) {
      if ((request as any)._dbUnavailable) {
        return NextResponse.json({ error: 'Service Unavailable: database unreachable' }, { status: 503 });
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (authenticatedRequest.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }
    return handler(authenticatedRequest, ...args);
  };
}

export function requireMaintainerOrAdmin<T extends any[]>(
  handler: (req: AuthenticatedRequest, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T) => {
    const authenticatedRequest = await authenticateRequest(request);
    if (!authenticatedRequest) {
      if ((request as any)._dbUnavailable) {
        return NextResponse.json({ error: 'Service Unavailable: database unreachable' }, { status: 503 });
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const role = authenticatedRequest.user?.role;
    if (role !== 'admin' && role !== 'maintainer') {
      return NextResponse.json({ error: 'Forbidden - Maintainer or Admin required' }, { status: 403 });
    }
    return handler(authenticatedRequest, ...args);
  };
}

export async function verifyAuth(request: NextRequest): Promise<{ success: boolean; userId?: string; error?: string }> {
  try {
    // Get token from cookie or Authorization header
    const token = request.cookies.get('auth-token')?.value || 
                  request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return { success: false, error: 'No token provided' };
    }
    
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      email: string;
      role: string;
    };
    
    // Verify user still exists in database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true }
    });
    
    if (!user) {
      return { success: false, error: 'User not found' };
    }
    
    return { success: true, userId: user.id };
  } catch (error) {
    console.error('Authentication error:', error);
    return { success: false, error: 'Invalid token' };
  }
} 