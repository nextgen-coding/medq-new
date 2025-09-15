const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testConnection() {
  try {
    console.log('🔗 Testing database connection...');
    
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Database connection successful!');
    
    const niveauxCount = await prisma.niveau.count();
    console.log(`📊 Found ${niveauxCount} niveaux in database`);
    
    if (niveauxCount === 0) {
      console.log('⚠️  No niveaux found. Creating default ones...');
      await prisma.niveau.createMany({
        data: [
          { name: 'PCEM1', order: 1 },
          { name: 'PCEM2', order: 2 },
          { name: 'DCEM1', order: 3 }
        ]
      });
      console.log('✅ Default niveaux created');
    }
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.log('\n💡 Try:');
    console.log('1. Check your .env file');
    console.log('2. Run: npx prisma generate');
    console.log('3. Run: npx prisma db push');
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
