import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();
    
    if (!code) {
      return NextResponse.json(
        { error: 'Authorization code is required' },
        { status: 400 }
      );
    }

    if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) {
      console.error('Facebook OAuth credentials not configured');
      return NextResponse.json(
        { error: 'Facebook OAuth is not configured' },
        { status: 500 }
      );
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://graph.facebook.com/v18.0/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: FACEBOOK_APP_ID,
        client_secret: FACEBOOK_APP_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${request.nextUrl.origin}/auth/callback`,
      }),
    });

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', await tokenResponse.text());
      return NextResponse.json(
        { error: 'Failed to exchange authorization code' },
        { status: 400 }
      );
    }

    const tokenData = await tokenResponse.json();
    const { access_token } = tokenData;

    // Get user info using access token
    const userInfoResponse = await fetch(`https://graph.facebook.com/v18.0/me?fields=id,name,email,picture&access_token=${access_token}`);

    if (!userInfoResponse.ok) {
      console.error('Failed to get user info:', await userInfoResponse.text());
      return NextResponse.json(
        { error: 'Failed to get user information' },
        { status: 400 }
      );
    }

    const userInfo = await userInfoResponse.json();
    const { id: facebookId, email, name, picture } = userInfo;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required from Facebook' },
        { status: 400 }
      );
    }

    // Check if user exists by Facebook ID or email
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { facebook_id: facebookId },
          { email: email }
        ]
      }
    });

    if (!user) {
      // Create new user
      user = await prisma.user.create({
        data: {
          email,
          name: name || undefined,
          image: picture?.data?.url || undefined,
          facebook_id: facebookId,
          role: 'student',
          profileCompleted: false, // New users need to complete their profile
        }
      });
    } else if (!user.facebook_id) {
      // Link existing email account with Facebook ID
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          facebook_id: facebookId,
          name: name || user.name,
          image: picture?.data?.url || user.image,
        }
      });
    }

    // Create JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Return user data (without password) and token
    const userWithoutPassword = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      image: user.image,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    const response = NextResponse.json({
      user: userWithoutPassword,
      token,
      message: 'Facebook sign-in successful'
    });

    // Set HTTP-only cookie
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;

  } catch (error) {
    console.error('Facebook callback error:', error);
    return NextResponse.json(
      { error: 'Facebook sign-in failed' },
      { status: 500 }
    );
  }
} 