// Database test script to verify Comment model
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function testCommentModel() {
  try {
    console.log('Testing Comment model...')
    
    // Test if we can query comments (should work even if empty)
    const commentCount = await prisma.comment.count()
    console.log(`✅ Comment model works! Found ${commentCount} comments in database`)
    
    // Test if we can query users
    const userCount = await prisma.user.count()
    console.log(`✅ User model works! Found ${userCount} users in database`)
    
    // Test if we can query lectures  
    const lectureCount = await prisma.lecture.count()
    console.log(`✅ Lecture model works! Found ${lectureCount} lectures in database`)
    
    console.log('🎉 All database models are working correctly!')
    
  } catch (error) {
    console.error('❌ Database test failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testCommentModel()
