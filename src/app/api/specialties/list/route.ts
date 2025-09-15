import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const items = await prisma.specialty.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' }
  })
  return NextResponse.json(items)
}
