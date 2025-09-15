import { NextResponse } from 'next/server';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';

async function getHandler(request: AuthenticatedRequest){
  try {
    const userId = request.user?.userId;
    if(!userId){
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role:true, niveauId:true, semesterId:true, id:true } });
    if(!user){ return NextResponse.json({ error: 'User not found' }, { status:404 }); }

    const where: any = {};
    if(user.role !== 'admin'){
      if(user.niveauId) where.niveauId = user.niveauId;
      if(user.semesterId) where.semesterId = user.semesterId; // restrict to same semester when present
    }

    const specialties = await prisma.specialty.findMany({
      where,
      select: { id:true, name:true }
    });

    // Fetch pinned specialties for marking
    const pins = await prisma.pinnedSpecialty.findMany({ where: { userId }, select: { specialtyId:true } });
    const pinnedSet = new Set(pins.map(p=> p.specialtyId));

    const payload = specialties.map(s => ({ id:s.id, name:s.name, pinned: pinnedSet.has(s.id) }));

    return NextResponse.json(payload.sort((a,b)=> a.name.localeCompare(b.name)));
  } catch(err){
    console.error('Error fetching accessible specialties', err);
    return NextResponse.json({ error: 'Failed to fetch specialties' }, { status:500 });
  }
}

export const GET = requireAuth(getHandler);
