import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const items = await prisma.lecture.findMany({
    select: {
      id: true,
      title: true,
      specialty: { select: { id: true, name: true } }
    },
    orderBy: [{ title: 'asc' }]
  })
  return NextResponse.json(items)
}
