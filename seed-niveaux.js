const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding niveaux...');

  // Exact set of niveaux as requested
  const niveaux = [
    { name: 'PCEM1', order: 1 },
    { name: 'PCEM2', order: 2 },
    { name: 'DCEM1', order: 3 },
    { name: 'DCEM2', order: 4 },
    { name: 'DCEM3', order: 5 },
  ];

  for (const niveau of niveaux) {
    const created = await prisma.niveau.upsert({
      where: { name: niveau.name },
      update: {},
      create: niveau,
    });
    console.log(`✅ ${created.name}`);

    // Seed semesters only for DCEM niveaux
    if (/^DCEM\d$/i.test(created.name)) {
      const semesterNames = [
        { name: `${created.name} - S1`, order: 1 },
        { name: `${created.name} - S2`, order: 2 },
      ];

      for (const s of semesterNames) {
        const sem = await prisma.semester.upsert({
          where: {
            // unique per (niveauId, order)
            niveauId_order: { niveauId: created.id, order: s.order },
          },
          update: { name: s.name },
          create: { name: s.name, order: s.order, niveauId: created.id },
        });
        console.log(`   ↳ Semester: ${sem.name}`);
      }
    }
  }

  console.log('✅ Done!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
