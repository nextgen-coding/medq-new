const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedTestData() {
  try {
    console.log('🌱 Seeding test data...');

    // Get the first niveau to use for specialties
    const niveau = await prisma.niveau.findFirst({
      orderBy: { order: 'asc' }
    });

    if (!niveau) {
      console.log('❌ No niveaux found. Please create niveaux first.');
      return;
    }

    console.log(`Using niveau: ${niveau.name}`);

    // Create some test specialties
    const specialties = [
      {
        name: 'Cardiologie',
        description: 'Spécialité médicale qui traite les maladies du cœur et des vaisseaux sanguins',
        niveauId: niveau.id,
        isFree: true
      },
      {
        name: 'Neurologie',
        description: 'Spécialité médicale qui traite les maladies du système nerveux',
        niveauId: niveau.id,
        isFree: false
      },
      {
        name: 'Gastroentérologie',
        description: 'Spécialité médicale qui traite les maladies du système digestif',
        niveauId: niveau.id,
        isFree: true
      }
    ];

    for (const specialtyData of specialties) {
      const specialty = await prisma.specialty.upsert({
        where: { name: specialtyData.name },
        update: {},
        create: specialtyData,
      });
      console.log(`✅ ${specialty.name} created/updated`);

      // Create some lectures for each specialty
      const lectures = [
        {
          title: `Introduction à ${specialty.name}`,
          description: `Cours d'introduction sur ${specialty.name}`,
          specialtyId: specialty.id,
          isFree: true
        },
        {
          title: `${specialty.name} Avancée`,
          description: `Cours avancé sur ${specialty.name}`,
          specialtyId: specialty.id,
          isFree: false
        }
      ];

      for (const lectureData of lectures) {
        const existingLecture = await prisma.lecture.findFirst({
          where: {
            title: lectureData.title,
            specialtyId: lectureData.specialtyId
          }
        });

        if (!existingLecture) {
          const lecture = await prisma.lecture.create({
            data: lectureData,
          });
          console.log(`  📚 ${lecture.title} created`);
        } else {
          console.log(`  📚 ${existingLecture.title} already exists`);
        }
      }
    }

    console.log('🎉 Test data seeded successfully!');
    
    // Show summary
    const totalSpecialties = await prisma.specialty.count();
    const totalLectures = await prisma.lecture.count();
    
    console.log(`\n📊 Summary:`);
    console.log(`  Specialties: ${totalSpecialties}`);
    console.log(`  Lectures: ${totalLectures}`);

  } catch (error) {
    console.error('❌ Error seeding data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedTestData();
