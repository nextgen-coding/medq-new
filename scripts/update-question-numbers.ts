#!/usr/bin/env ts-node

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateQuestionNumbers() {
  try {
    // Get all lectures with their questions
    const lectures = await prisma.lecture.findMany({
      include: {
        questions: {
          orderBy: [
            { type: 'asc' },
            { createdAt: 'asc' }
          ]
        }
      }
    });

    console.log(`Found ${lectures.length} lectures to process`);

    for (const lecture of lectures) {
      console.log(`Processing lecture: ${lecture.title} (${lecture.questions.length} questions)`);
      
      // Group questions by type
      const questionsByType = lecture.questions.reduce((groups, question) => {
        if (!groups[question.type]) {
          groups[question.type] = [];
        }
        groups[question.type].push(question);
        return groups;
      }, {} as Record<string, typeof lecture.questions>);

      // Update question numbers for each type
      for (const [type, questions] of Object.entries(questionsByType)) {
        console.log(`  Updating ${questions.length} questions of type: ${type}`);
        
        for (let i = 0; i < questions.length; i++) {
          const question = questions[i];
          const newNumber = i + 1;
          
          if (question.number !== newNumber) {
            await prisma.question.update({
              where: { id: question.id },
              data: { number: newNumber }
            });
            console.log(`    Updated question ${question.id}: number ${question.number} -> ${newNumber}`);
          }
        }
      }
    }

    console.log('Question numbers updated successfully!');
  } catch (error) {
    console.error('Error updating question numbers:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateQuestionNumbers();
