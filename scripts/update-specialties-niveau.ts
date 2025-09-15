import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateSpecialtiesNiveau() {
  try {
    console.log('Updating all specialties with niveau ID...');
    
    const targetNiveauId = 'b41a4c10-6428-46e6-9eba-90c8f9946418';
    
    // First, verify the niveau exists
    const niveau = await prisma.niveau.findUnique({
      where: { id: targetNiveauId }
    });
    
    if (!niveau) {
      console.error('Niveau with ID', targetNiveauId, 'not found!');
      return;
    }
    
    console.log('Found niveau:', niveau.name);
    
    // Update all specialties to use this niveau
    const result = await prisma.specialty.updateMany({
      where: {
        niveauId: null // Only update specialties that don't have a niveau assigned
      },
      data: {
        niveauId: targetNiveauId
      }
    });
    
    console.log(`Updated ${result.count} specialties with niveau ID: ${targetNiveauId}`);
    
    // Show the updated specialties
    const updatedSpecialties = await prisma.specialty.findMany({
      include: {
        niveau: true
      }
    });
    
    console.log('\nUpdated specialties:');
    updatedSpecialties.forEach(specialty => {
      console.log(`- ${specialty.name} (Niveau: ${specialty.niveau?.name || 'None'})`);
    });
    
  } catch (error) {
    console.error('Error updating specialties:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateSpecialtiesNiveau(); 