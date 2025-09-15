import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import bcrypt from 'bcryptjs';
import { sendVerificationEmail } from '../../../../lib/email';
import { generateToken } from '../../../../lib/tokens';
import { validatePassword } from '../../../../lib/password-validation';

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json();
    
    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        { error: passwordValidation.errors[0] },
        { status: 400 }
      );
    }
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });
    
    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Generate verification token
    const verificationToken = generateToken();
    
    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || null,
        role: 'student', // Default role
        status: 'pending',
        verificationToken,
        passwordUpdatedAt: new Date(),
        profileCompleted: false // New users need to complete their profile
      }
    });
    
    // Send verification email
    let emailSent = false;
    let emailError: Error | null = null;
    
    try {
      await sendVerificationEmail(email, verificationToken, name);
      emailSent = true;
    } catch (error) {
      console.error('Error sending verification email:', error);
      emailError = error as Error;
      // Don't fail registration if email fails, but log it
    }
    
    // Return user data (without password and token)
    const userWithoutSensitiveData = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      image: user.image,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
    
    return NextResponse.json({
      user: userWithoutSensitiveData,
      message: emailSent 
        ? 'User registered successfully. Please check your email to verify your account.'
        : 'User registered successfully, but there was an issue sending the verification email. Please contact support.',
      emailSent,
      emailError: emailError ? emailError.message : null
    }, { status: 201 });
    
  } catch (error) {
    console.error('Error registering user:', error);
    return NextResponse.json(
      { error: 'Failed to register user' },
      { status: 500 }
    );
  }
} 