// Test script to verify the new numbering logic for question creation
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testNumberingLogic() {
  console.log('Testing numbering logic for question creation...\n');
  
  try {
    // Get a sample lecture ID
    const lecture = await prisma.lecture.findFirst();
    if (!lecture) {
      console.log('No lectures found. Please create a lecture first.');
      return;
    }
    
    console.log(`Using lecture: ${lecture.title} (ID: ${lecture.id})\n`);
    
    // Simulate the logic from CreateQuestionDialog
    const lectureId = lecture.id;
    
    // 1. Test Clinical Case numbering (1-999)
    console.log('1. Testing Clinical Case numbering:');
    const clinicalCaseNumbers = (await prisma.question.findMany({
      where: { lectureId },
      select: { caseNumber: true, type: true }
    }))
      .filter(q => (q.type === 'clinic_mcq' || q.type === 'clinic_croq') && q.caseNumber && q.caseNumber < 1000)
      .map(q => q.caseNumber);
    
    const nextClinicalCase = clinicalCaseNumbers.length > 0 ? Math.max(...clinicalCaseNumbers) + 1 : 1;
    console.log(`   Existing clinical case numbers: [${clinicalCaseNumbers.join(', ')}]`);
    console.log(`   Next clinical case number: ${nextClinicalCase}\n`);
    
    // 2. Test Multi-QROC numbering (1000-1999)
    console.log('2. Testing Multi-QROC numbering:');
    const qrocGroupNumbers = (await prisma.question.findMany({
      where: { lectureId },
      select: { caseNumber: true, type: true }
    }))
      .filter(q => q.type === 'qroc' && q.caseNumber && q.caseNumber >= 1000 && q.caseNumber < 2000)
      .map(q => q.caseNumber);
    
    const nextQrocGroup = qrocGroupNumbers.length > 0 ? Math.max(...qrocGroupNumbers) + 1 : 1000;
    console.log(`   Existing QROC group numbers: [${qrocGroupNumbers.join(', ')}]`);
    console.log(`   Next QROC group number: ${nextQrocGroup}\n`);
    
    // 3. Test Multi-MCQ numbering (2000-2999)
    console.log('3. Testing Multi-MCQ numbering:');
    const mcqGroupNumbers = (await prisma.question.findMany({
      where: { lectureId },
      select: { caseNumber: true, type: true }
    }))
      .filter(q => q.type === 'mcq' && q.caseNumber && q.caseNumber >= 2000 && q.caseNumber < 3000)
      .map(q => q.caseNumber);
    
    const nextMcqGroup = mcqGroupNumbers.length > 0 ? Math.max(...mcqGroupNumbers) + 1 : 2000;
    console.log(`   Existing MCQ group numbers: [${mcqGroupNumbers.join(', ')}]`);
    console.log(`   Next MCQ group number: ${nextMcqGroup}\n`);
    
    // 4. Show all caseNumbers to verify no conflicts
    console.log('4. All caseNumbers in lecture:');
    const allCaseNumbers = await prisma.question.findMany({
      where: { lectureId, caseNumber: { not: null } },
      select: { caseNumber: true, type: true, text: true },
      orderBy: { caseNumber: 'asc' }
    });
    
    allCaseNumbers.forEach(q => {
      const range = q.caseNumber < 1000 ? 'Clinical' : 
                   q.caseNumber < 2000 ? 'QROC Group' : 
                   q.caseNumber < 3000 ? 'MCQ Group' : 'Unknown';
      console.log(`   ${q.caseNumber} (${q.type}) - ${range}: ${q.text.substring(0, 50)}...`);
    });
    
    console.log('\n✅ Numbering logic verification complete!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testNumberingLogic();
