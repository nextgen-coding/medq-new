import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'

async function handler(request: AuthenticatedRequest) {
  try {
    const formData = await request.formData()
    const paymentId = formData.get('paymentId') as string
    const file = formData.get('file') as File

    if (!paymentId || !file) {
      return NextResponse.json(
        { error: 'Payment ID and file are required' },
        { status: 400 }
      )
    }

    // Verify payment belongs to user
    const payment = await prisma.payment.findFirst({
      where: {
        id: paymentId,
        userId: request.user!.userId,
        method: 'custom_payment'
      }
    })

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    // Upload file (you'll need to implement file upload logic)
    // For now, let's assume we have an upload service
    const uploadResponse = await fetch('/api/upload/image', {
      method: 'POST',
      body: formData
    })

    if (!uploadResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to upload image' },
        { status: 500 }
      )
    }

    const { url: imageUrl } = await uploadResponse.json()

    // Update payment with proof image
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        proofImageUrl: imageUrl,
        status: 'awaiting_verification'
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Proof uploaded successfully. Awaiting admin verification.',
      imageUrl
    })

  } catch (error) {
    console.error('Proof upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const POST = requireAuth(handler)
