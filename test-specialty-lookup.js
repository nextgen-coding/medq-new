const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testSpecialtyLookup() {
  console.log('🔍 Testing specialty lookup...');
  
  const targetId = '09f87e13-b011-44ef-a44c-cb28f89d019d';
  const targetName = 'Pneumologie';
  
  try {
    // Test 1: Direct ID lookup
    console.log('\n1. Direct ID lookup:');
    const byId = await prisma.specialty.findUnique({
      where: { id: targetId },
      select: { id: true, name: true, createdAt: true }
    });
    console.log('Result:', byId);
    
    // Test 2: All specialties sample
    console.log('\n2. All specialties (first 10):');
    const allSpecialties = await prisma.specialty.findMany({
      take: 10,
      select: { id: true, name: true }
    });
    console.log('Results:', allSpecialties);
    
    // Test 3: Sessions linked to this specialty
    console.log('\n3. Sessions for specialty ID:');
    const sessions = await prisma.session.findMany({
      where: { specialtyId: targetId },
      select: { id: true, name: true, specialtyId: true }
    });
    console.log('Sessions:', sessions);
    
    // Test 4: Specialty with sessions include (API query)
    console.log('\n4. Specialty with sessions (API simulation):');
    const withSessions = await prisma.specialty.findUnique({
      where: { id: targetId },
      include: {
        niveau: { select: { id: true, name: true } },
        semester: { select: { id: true, name: true, order: true } },
        sessions: {
          include: {
            niveau: { select: { id: true, name: true } },
            semester: { select: { id: true, name: true, order: true } }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    console.log('With sessions:', withSessions ? {
      id: withSessions.id,
      name: withSessions.name,
      sessionsCount: withSessions.sessions.length
    } : 'NOT FOUND');
    
    // Test 5: Name lookup
    console.log('\n5. Name lookup (exact):');
    const byName = await prisma.specialty.findFirst({
      where: { name: { equals: targetName, mode: 'insensitive' } },
      select: { id: true, name: true }
    });
    console.log('Result:', byName);
    
    // Test 6: Name lookup (contains)
    console.log('\n6. Name lookup (contains):');
    const byNameContains = await prisma.specialty.findMany({
      where: { name: { contains: targetName, mode: 'insensitive' } },
      select: { id: true, name: true },
      take: 5
    });
    console.log('Results:', byNameContains);
    
    // Test 7: Specialties with sessions (index query)
    console.log('\n7. Specialties with sessions (index query):');
    const withSessionsIndex = await prisma.specialty.findMany({
      where: {
        sessions: { some: {} }
      },
      select: { id: true, name: true },
      take: 5
    });
    console.log('Results:', withSessionsIndex);
    
    // Test 8: Database info
    console.log('\n8. Database URL check:');
    console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
    console.log('DATABASE_URL starts with:', process.env.DATABASE_URL?.substring(0, 20));
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testSpecialtyLookup();
