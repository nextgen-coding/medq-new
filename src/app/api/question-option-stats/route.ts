import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const questionId = req.nextUrl.searchParams.get('questionId');
    if (!questionId) return NextResponse.json({ error: 'questionId required' }, { status: 400 });
  const rows = await (prisma as any).questionOptionStat.findMany({ where: { questionId } });
  const totalRow = rows.find((r: any) => r.optionKey === 'TOTAL');
  const optionRows = rows.filter((r: any) => r.optionKey !== 'TOTAL');
    return NextResponse.json({
      total: totalRow?.count || 0,
  options: optionRows.map((r: any) => ({ optionId: r.optionKey, count: r.count }))
    });
  } catch (e) {
    console.error('GET stats error', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { questionId, optionIds } = body || {};
    if (!questionId || !Array.isArray(optionIds) || optionIds.length === 0) {
      return NextResponse.json({ error: 'questionId & optionIds required' }, { status: 400 });
    }
    await prisma.$transaction(async tx => {
      // total attempts row
      await (tx as any).questionOptionStat.upsert({
        where: { questionId_optionKey: { questionId, optionKey: 'TOTAL' } },
        update: { count: { increment: 1 } },
        create: { questionId, optionKey: 'TOTAL', count: 1 }
      });
      for (const oid of optionIds) {
  await (tx as any).questionOptionStat.upsert({
          where: { questionId_optionKey: { questionId, optionKey: oid } },
          update: { count: { increment: 1 } },
          create: { questionId, optionKey: oid, count: 1 }
        });
      }
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('POST stats error', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
