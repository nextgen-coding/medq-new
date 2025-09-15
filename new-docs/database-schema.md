# Database Schema Documentation

## 🗄️ Overview

This document provides comprehensive database schema documentation for the Medical Question Platform, covering all tables, relationships, and constraints required for the admin validation and import systems.

## 🏗️ Database Technology Stack

- **Database**: PostgreSQL 14+
- **ORM**: Prisma 5.x
- **Migration Tool**: Prisma Migrate
- **Connection Pooling**: Prisma connection pooling

## 📊 Core Schema

### User Management

#### User Table
```sql
-- Users table for authentication and authorization
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_isActive_idx" ON "User"("isActive");
```

**Prisma Schema**:
```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  password      String?
  role          String    @default("user") // 'admin', 'maintainer', 'user'
  isActive      Boolean   @default(true)
  emailVerified Boolean   @default(false)
  lastLoginAt   DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relations
  aiValidationJobs AiValidationJob[]
  sessions         Session[]
  reports          Report[]

  @@index([role])
  @@index([isActive])
}
```

### Academic Structure

#### Specialty Table
```sql
-- Medical specialties (Cardiologie, Neurologie, etc.)
CREATE TABLE "Specialty" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Specialty_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "Specialty_name_key" ON "Specialty"("name");
CREATE INDEX "Specialty_isActive_idx" ON "Specialty"("isActive");
```

**Prisma Schema**:
```prisma
model Specialty {
  id          String  @id @default(cuid())
  name        String  @unique
  description String?
  isActive    Boolean @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relations
  courses       Course[]
  questions     Question[]
  clinicalCases ClinicalCase[]
  sessions      Session[]

  @@index([isActive])
}
```

#### Course Table
```sql
-- Courses within specialties
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "specialtyId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "Course" ADD CONSTRAINT "Course_specialtyId_fkey" 
    FOREIGN KEY ("specialtyId") REFERENCES "Specialty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "Course_specialtyId_idx" ON "Course"("specialtyId");
CREATE INDEX "Course_isActive_idx" ON "Course"("isActive");
CREATE UNIQUE INDEX "Course_name_specialtyId_key" ON "Course"("name", "specialtyId");
```

**Prisma Schema**:
```prisma
model Course {
  id          String  @id @default(cuid())
  name        String
  description String?
  specialtyId String
  isActive    Boolean @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relations
  specialty Specialty @relation(fields: [specialtyId], references: [id], onDelete: Cascade)
  questions Question[]

  @@unique([name, specialtyId])
  @@index([specialtyId])
  @@index([isActive])
}
```

#### Clinical Case Table
```sql
-- Clinical cases for case-based questions
CREATE TABLE "ClinicalCase" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "patientInfo" TEXT,
    "specialtyId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicalCase_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "ClinicalCase" ADD CONSTRAINT "ClinicalCase_specialtyId_fkey" 
    FOREIGN KEY ("specialtyId") REFERENCES "Specialty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "ClinicalCase_specialtyId_idx" ON "ClinicalCase"("specialtyId");
CREATE INDEX "ClinicalCase_isActive_idx" ON "ClinicalCase"("isActive");
```

**Prisma Schema**:
```prisma
model ClinicalCase {
  id          String  @id @default(cuid())
  title       String
  description String
  patientInfo String?
  specialtyId String
  isActive    Boolean @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relations
  specialty Specialty @relation(fields: [specialtyId], references: [id], onDelete: Cascade)
  questions Question[]

  @@index([specialtyId])
  @@index([isActive])
}
```

### Question Management

#### Question Table
```sql
-- Medical questions (QCM, QROC, case-based)
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL, -- 'qcm', 'qroc', 'cas_qcm', 'cas_qroc'
    "questionText" TEXT NOT NULL,
    
    -- QCM specific fields
    "optionA" TEXT,
    "optionB" TEXT,
    "optionC" TEXT,
    "optionD" TEXT,
    "optionE" TEXT,
    "correctAnswer" TEXT, -- 'A', 'B', 'C', 'D', 'E'
    
    -- QROC specific fields
    "answer" TEXT,
    
    -- Common fields
    "explanation" TEXT NOT NULL,
    "level" TEXT NOT NULL, -- 'PCEM1', 'PCEM2', 'DCEM1', etc.
    "semester" TEXT NOT NULL,
    
    -- Relations
    "specialtyId" TEXT NOT NULL,
    "courseId" TEXT,
    "clinicalCaseId" TEXT,
    
    -- Metadata
    "difficulty" INTEGER DEFAULT 1, -- 1-5 scale
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isValidated" BOOLEAN NOT NULL DEFAULT false,
    "validatedAt" TIMESTAMP(3),
    "validatedBy" TEXT,
    
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "Question" ADD CONSTRAINT "Question_specialtyId_fkey" 
    FOREIGN KEY ("specialtyId") REFERENCES "Specialty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Question" ADD CONSTRAINT "Question_courseId_fkey" 
    FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Question" ADD CONSTRAINT "Question_clinicalCaseId_fkey" 
    FOREIGN KEY ("clinicalCaseId") REFERENCES "ClinicalCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Question" ADD CONSTRAINT "Question_validatedBy_fkey" 
    FOREIGN KEY ("validatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "Question_type_idx" ON "Question"("type");
CREATE INDEX "Question_specialtyId_idx" ON "Question"("specialtyId");
CREATE INDEX "Question_courseId_idx" ON "Question"("courseId");
CREATE INDEX "Question_clinicalCaseId_idx" ON "Question"("clinicalCaseId");
CREATE INDEX "Question_level_idx" ON "Question"("level");
CREATE INDEX "Question_semester_idx" ON "Question"("semester");
CREATE INDEX "Question_isActive_idx" ON "Question"("isActive");
CREATE INDEX "Question_isValidated_idx" ON "Question"("isValidated");
CREATE INDEX "Question_difficulty_idx" ON "Question"("difficulty");
```

**Prisma Schema**:
```prisma
model Question {
  id              String  @id @default(cuid())
  type            String  // 'qcm', 'qroc', 'cas_qcm', 'cas_qroc'
  questionText    String
  
  // QCM specific fields
  optionA         String?
  optionB         String?
  optionC         String?
  optionD         String?
  optionE         String?
  correctAnswer   String? // 'A', 'B', 'C', 'D', 'E'
  
  // QROC specific fields
  answer          String?
  
  // Common fields
  explanation     String
  level           String  // 'PCEM1', 'PCEM2', 'DCEM1', etc.
  semester        String
  
  // Relations
  specialtyId     String
  courseId        String?
  clinicalCaseId  String?
  
  // Metadata
  difficulty      Int?     @default(1) // 1-5 scale
  isActive        Boolean  @default(true)
  isValidated     Boolean  @default(false)
  validatedAt     DateTime?
  validatedBy     String?
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Relations
  specialty       Specialty      @relation(fields: [specialtyId], references: [id], onDelete: Restrict)
  course          Course?        @relation(fields: [courseId], references: [id], onDelete: SetNull)
  clinicalCase    ClinicalCase?  @relation(fields: [clinicalCaseId], references: [id], onDelete: SetNull)
  validator       User?          @relation(fields: [validatedBy], references: [id], onDelete: SetNull)
  
  // Question usage
  sessionQuestions SessionQuestion[]
  userAnswers      UserQuestionAnswer[]

  @@index([type])
  @@index([specialtyId])
  @@index([courseId])
  @@index([clinicalCaseId])
  @@index([level])
  @@index([semester])
  @@index([isActive])
  @@index([isValidated])
  @@index([difficulty])
}
```

### AI Validation System

#### AI Validation Job Table
```sql
-- AI validation jobs for processing uploaded files
CREATE TABLE "AiValidationJob" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileUrl" TEXT,
    "outputUrl" TEXT,
    
    -- Job status and progress
    "status" TEXT NOT NULL DEFAULT 'queued', -- 'queued', 'processing', 'completed', 'failed', 'cancelled'
    "progress" INTEGER NOT NULL DEFAULT 0, -- 0-100
    "message" TEXT,
    "errorMessage" TEXT,
    
    -- Processing details
    "totalItems" INTEGER DEFAULT 0,
    "processedItems" INTEGER DEFAULT 0,
    "currentBatch" INTEGER DEFAULT 1,
    "totalBatches" INTEGER DEFAULT 1,
    
    -- AI processing stats
    "ragAppliedCount" INTEGER DEFAULT 0,
    "fixedCount" INTEGER DEFAULT 0,
    "successfulAnalyses" INTEGER DEFAULT 0,
    "failedAnalyses" INTEGER DEFAULT 0,
    "retryAttempts" INTEGER DEFAULT 0,
    
    -- Timing
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    
    -- User and configuration
    "userId" TEXT NOT NULL,
    "instructions" TEXT,
    "config" JSONB,

    CONSTRAINT "AiValidationJob_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "AiValidationJob" ADD CONSTRAINT "AiValidationJob_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "AiValidationJob_status_idx" ON "AiValidationJob"("status");
CREATE INDEX "AiValidationJob_userId_idx" ON "AiValidationJob"("userId");
CREATE INDEX "AiValidationJob_createdAt_idx" ON "AiValidationJob"("createdAt");
CREATE INDEX "AiValidationJob_progress_idx" ON "AiValidationJob"("progress");
```

**Prisma Schema**:
```prisma
model AiValidationJob {
  id               String    @id @default(cuid())
  fileName         String
  originalFileName String
  fileSize         Int
  fileUrl          String?
  outputUrl        String?
  
  // Job status and progress
  status           String    @default("queued") // 'queued', 'processing', 'completed', 'failed', 'cancelled'
  progress         Int       @default(0) // 0-100
  message          String?
  errorMessage     String?
  
  // Processing details
  totalItems       Int?      @default(0)
  processedItems   Int?      @default(0)
  currentBatch     Int?      @default(1)
  totalBatches     Int?      @default(1)
  
  // AI processing stats
  ragAppliedCount     Int?   @default(0)
  fixedCount          Int?   @default(0)
  successfulAnalyses  Int?   @default(0)
  failedAnalyses      Int?   @default(0)
  retryAttempts       Int?   @default(0)
  
  // Timing
  createdAt        DateTime  @default(now())
  startedAt        DateTime?
  completedAt      DateTime?
  updatedAt        DateTime  @updatedAt
  
  // User and configuration
  userId           String
  instructions     String?
  config           Json?

  // Relations
  user             User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([status])
  @@index([userId])
  @@index([createdAt])
  @@index([progress])
}
```

### Session and Assessment System

#### Session Table
```sql
-- Exam sessions
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "pdfUrl" TEXT,
    "correctionUrl" TEXT,
    
    -- Academic classification
    "niveau" TEXT NOT NULL,
    "semestre" TEXT NOT NULL,
    "specialtyId" TEXT NOT NULL,
    
    -- Session configuration
    "timeLimit" INTEGER, -- in minutes
    "questionCount" INTEGER DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    
    -- Metadata
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "Session" ADD CONSTRAINT "Session_specialtyId_fkey" 
    FOREIGN KEY ("specialtyId") REFERENCES "Specialty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_createdBy_fkey" 
    FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "Session_specialtyId_idx" ON "Session"("specialtyId");
CREATE INDEX "Session_niveau_idx" ON "Session"("niveau");
CREATE INDEX "Session_semestre_idx" ON "Session"("semestre");
CREATE INDEX "Session_isActive_idx" ON "Session"("isActive");
CREATE INDEX "Session_isPublished_idx" ON "Session"("isPublished");
CREATE INDEX "Session_createdBy_idx" ON "Session"("createdBy");
```

**Prisma Schema**:
```prisma
model Session {
  id            String  @id @default(cuid())
  name          String
  description   String?
  pdfUrl        String?
  correctionUrl String?
  
  // Academic classification
  niveau        String
  semestre      String
  specialtyId   String
  
  // Session configuration
  timeLimit     Int?    // in minutes
  questionCount Int?    @default(0)
  isActive      Boolean @default(true)
  isPublished   Boolean @default(false)
  
  // Metadata
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  createdBy     String?

  // Relations
  specialty     Specialty        @relation(fields: [specialtyId], references: [id], onDelete: Restrict)
  creator       User?            @relation(fields: [createdBy], references: [id], onDelete: SetNull)
  questions     SessionQuestion[]
  userSessions  UserSession[]

  @@index([specialtyId])
  @@index([niveau])
  @@index([semestre])
  @@index([isActive])
  @@index([isPublished])
  @@index([createdBy])
}
```

#### Session Question Table
```sql
-- Questions assigned to sessions
CREATE TABLE "SessionQuestion" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "points" INTEGER DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionQuestion_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "SessionQuestion" ADD CONSTRAINT "SessionQuestion_sessionId_fkey" 
    FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SessionQuestion" ADD CONSTRAINT "SessionQuestion_questionId_fkey" 
    FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "SessionQuestion_sessionId_idx" ON "SessionQuestion"("sessionId");
CREATE INDEX "SessionQuestion_questionId_idx" ON "SessionQuestion"("questionId");
CREATE UNIQUE INDEX "SessionQuestion_sessionId_questionId_key" ON "SessionQuestion"("sessionId", "questionId");
CREATE UNIQUE INDEX "SessionQuestion_sessionId_order_key" ON "SessionQuestion"("sessionId", "order");
```

**Prisma Schema**:
```prisma
model SessionQuestion {
  id         String   @id @default(cuid())
  sessionId  String
  questionId String
  order      Int
  points     Int?     @default(1)
  createdAt  DateTime @default(now())

  // Relations
  session    Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  question   Question @relation(fields: [questionId], references: [id], onDelete: Cascade)

  @@unique([sessionId, questionId])
  @@unique([sessionId, order])
  @@index([sessionId])
  @@index([questionId])
}
```

### User Progress and Analytics

#### User Session Table
```sql
-- User session attempts
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    
    -- Session state
    "status" TEXT NOT NULL DEFAULT 'started', -- 'started', 'paused', 'completed', 'abandoned'
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "timeSpent" INTEGER DEFAULT 0, -- in seconds
    
    -- Results
    "score" DECIMAL(5,2),
    "totalQuestions" INTEGER DEFAULT 0,
    "correctAnswers" INTEGER DEFAULT 0,
    "incorrectAnswers" INTEGER DEFAULT 0,
    "unansweredQuestions" INTEGER DEFAULT 0,
    
    -- Metadata
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_sessionId_fkey" 
    FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "UserSession_userId_idx" ON "UserSession"("userId");
CREATE INDEX "UserSession_sessionId_idx" ON "UserSession"("sessionId");
CREATE INDEX "UserSession_status_idx" ON "UserSession"("status");
CREATE INDEX "UserSession_startedAt_idx" ON "UserSession"("startedAt");
CREATE INDEX "UserSession_score_idx" ON "UserSession"("score");
```

**Prisma Schema**:
```prisma
model UserSession {
  id                   String    @id @default(cuid())
  userId               String
  sessionId            String
  
  // Session state
  status               String    @default("started") // 'started', 'paused', 'completed', 'abandoned'
  startedAt            DateTime  @default(now())
  completedAt          DateTime?
  timeSpent            Int?      @default(0) // in seconds
  
  // Results
  score                Decimal?  @db.Decimal(5,2)
  totalQuestions       Int?      @default(0)
  correctAnswers       Int?      @default(0)
  incorrectAnswers     Int?      @default(0)
  unansweredQuestions  Int?      @default(0)
  
  // Metadata
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  // Relations
  user                 User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  session              Session            @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  answers              UserQuestionAnswer[]

  @@index([userId])
  @@index([sessionId])
  @@index([status])
  @@index([startedAt])
  @@index([score])
}
```

#### User Question Answer Table
```sql
-- Individual question answers
CREATE TABLE "UserQuestionAnswer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "userSessionId" TEXT,
    
    -- Answer data
    "selectedAnswer" TEXT, -- For QCM: 'A', 'B', 'C', 'D', 'E'
    "textAnswer" TEXT,     -- For QROC
    "isCorrect" BOOLEAN,
    "timeSpent" INTEGER DEFAULT 0, -- in seconds
    
    -- Metadata
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserQuestionAnswer_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "UserQuestionAnswer" ADD CONSTRAINT "UserQuestionAnswer_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserQuestionAnswer" ADD CONSTRAINT "UserQuestionAnswer_questionId_fkey" 
    FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserQuestionAnswer" ADD CONSTRAINT "UserQuestionAnswer_userSessionId_fkey" 
    FOREIGN KEY ("userSessionId") REFERENCES "UserSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "UserQuestionAnswer_userId_idx" ON "UserQuestionAnswer"("userId");
CREATE INDEX "UserQuestionAnswer_questionId_idx" ON "UserQuestionAnswer"("questionId");
CREATE INDEX "UserQuestionAnswer_userSessionId_idx" ON "UserQuestionAnswer"("userSessionId");
CREATE INDEX "UserQuestionAnswer_isCorrect_idx" ON "UserQuestionAnswer"("isCorrect");
CREATE INDEX "UserQuestionAnswer_answeredAt_idx" ON "UserQuestionAnswer"("answeredAt");
CREATE UNIQUE INDEX "UserQuestionAnswer_userId_questionId_userSessionId_key" 
    ON "UserQuestionAnswer"("userId", "questionId", "userSessionId");
```

**Prisma Schema**:
```prisma
model UserQuestionAnswer {
  id            String    @id @default(cuid())
  userId        String
  questionId    String
  userSessionId String?
  
  // Answer data
  selectedAnswer String?  // For QCM: 'A', 'B', 'C', 'D', 'E'
  textAnswer     String?  // For QROC
  isCorrect      Boolean?
  timeSpent      Int?     @default(0) // in seconds
  
  // Metadata
  answeredAt     DateTime @default(now())
  createdAt      DateTime @default(now())

  // Relations
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  question       Question     @relation(fields: [questionId], references: [id], onDelete: Cascade)
  userSession    UserSession? @relation(fields: [userSessionId], references: [id], onDelete: SetNull)

  @@unique([userId, questionId, userSessionId])
  @@index([userId])
  @@index([questionId])
  @@index([userSessionId])
  @@index([isCorrect])
  @@index([answeredAt])
}
```

## 🔧 Database Functions and Triggers

### Automatic Question Count Update
```sql
-- Function to update question count in sessions
CREATE OR REPLACE FUNCTION update_session_question_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE "Session" 
        SET "questionCount" = (
            SELECT COUNT(*) 
            FROM "SessionQuestion" 
            WHERE "sessionId" = NEW."sessionId"
        )
        WHERE "id" = NEW."sessionId";
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE "Session" 
        SET "questionCount" = (
            SELECT COUNT(*) 
            FROM "SessionQuestion" 
            WHERE "sessionId" = OLD."sessionId"
        )
        WHERE "id" = OLD."sessionId";
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for session question count
CREATE TRIGGER session_question_count_trigger
    AFTER INSERT OR DELETE ON "SessionQuestion"
    FOR EACH ROW
    EXECUTE FUNCTION update_session_question_count();
```

### User Session Score Calculation
```sql
-- Function to calculate user session scores
CREATE OR REPLACE FUNCTION calculate_user_session_score()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE "UserSession"
    SET 
        "totalQuestions" = (
            SELECT COUNT(*) 
            FROM "UserQuestionAnswer" 
            WHERE "userSessionId" = NEW."userSessionId"
        ),
        "correctAnswers" = (
            SELECT COUNT(*) 
            FROM "UserQuestionAnswer" 
            WHERE "userSessionId" = NEW."userSessionId" AND "isCorrect" = true
        ),
        "incorrectAnswers" = (
            SELECT COUNT(*) 
            FROM "UserQuestionAnswer" 
            WHERE "userSessionId" = NEW."userSessionId" AND "isCorrect" = false
        ),
        "score" = (
            SELECT CASE 
                WHEN COUNT(*) = 0 THEN 0
                ELSE ROUND(
                    (COUNT(*) FILTER (WHERE "isCorrect" = true) * 100.0) / COUNT(*), 
                    2
                )
            END
            FROM "UserQuestionAnswer" 
            WHERE "userSessionId" = NEW."userSessionId"
        )
    WHERE "id" = NEW."userSessionId";
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for score calculation
CREATE TRIGGER user_session_score_trigger
    AFTER INSERT OR UPDATE ON "UserQuestionAnswer"
    FOR EACH ROW
    WHEN (NEW."userSessionId" IS NOT NULL)
    EXECUTE FUNCTION calculate_user_session_score();
```

## 📊 Database Views

### Question Statistics View
```sql
-- View for question statistics
CREATE VIEW question_statistics AS
SELECT 
    q."id",
    q."type",
    q."specialtyId",
    s."name" as "specialtyName",
    q."level",
    q."semester",
    q."isValidated",
    COUNT(uqa."id") as "totalAnswers",
    COUNT(CASE WHEN uqa."isCorrect" = true THEN 1 END) as "correctAnswers",
    CASE 
        WHEN COUNT(uqa."id") = 0 THEN 0
        ELSE ROUND(
            (COUNT(CASE WHEN uqa."isCorrect" = true THEN 1 END) * 100.0) / COUNT(uqa."id"), 
            2
        )
    END as "successRate",
    AVG(uqa."timeSpent") as "averageTimeSpent"
FROM "Question" q
LEFT JOIN "Specialty" s ON q."specialtyId" = s."id"
LEFT JOIN "UserQuestionAnswer" uqa ON q."id" = uqa."questionId"
WHERE q."isActive" = true
GROUP BY q."id", s."name";
```

### User Performance View
```sql
-- View for user performance analytics
CREATE VIEW user_performance AS
SELECT 
    u."id" as "userId",
    u."email",
    u."name",
    COUNT(DISTINCT us."id") as "sessionsCompleted",
    COUNT(DISTINCT uqa."questionId") as "questionsAnswered",
    AVG(us."score") as "averageScore",
    SUM(us."timeSpent") as "totalTimeSpent",
    COUNT(CASE WHEN uqa."isCorrect" = true THEN 1 END) as "correctAnswers",
    COUNT(CASE WHEN uqa."isCorrect" = false THEN 1 END) as "incorrectAnswers",
    MAX(us."completedAt") as "lastActivity"
FROM "User" u
LEFT JOIN "UserSession" us ON u."id" = us."userId"
LEFT JOIN "UserQuestionAnswer" uqa ON u."id" = uqa."userId"
WHERE u."isActive" = true
GROUP BY u."id";
```

## 🏃‍♂️ Migration Scripts

### Initial Schema Migration
```sql
-- Migration: 001_initial_schema.sql
-- Create all tables in correct order (respecting foreign key dependencies)

-- Users first (no dependencies)
-- ... User table creation ...

-- Academic structure (depends on User)
-- ... Specialty, Course, ClinicalCase tables ...

-- Questions (depends on academic structure)
-- ... Question table ...

-- AI Validation (depends on User)
-- ... AiValidationJob table ...

-- Sessions (depends on academic structure)
-- ... Session, SessionQuestion tables ...

-- User progress (depends on User, Question, Session)
-- ... UserSession, UserQuestionAnswer tables ...
```

### Data Seeding Migration
```sql
-- Migration: 002_seed_data.sql
-- Insert initial specialties
INSERT INTO "Specialty" ("id", "name", "description") VALUES
('spec1', 'Cardiologie', 'Spécialité médicale qui traite les troubles du cœur'),
('spec2', 'Neurologie', 'Spécialité médicale qui traite les troubles du système nerveux'),
('spec3', 'Pneumologie', 'Spécialité médicale qui traite les troubles respiratoires'),
('spec4', 'Gastroentérologie', 'Spécialité médicale qui traite les troubles digestifs');

-- Insert academic levels
-- Note: Levels are stored as strings in questions, not separate table
-- Common values: 'PCEM1', 'PCEM2', 'DCEM1', 'DCEM2', 'DCEM3', 'DCEM4'

-- Insert default admin user (password should be hashed)
INSERT INTO "User" ("id", "email", "name", "role", "password", "emailVerified") VALUES
('admin1', 'admin@medq.com', 'System Administrator', 'admin', '$hashed_password', true);
```

## 🔍 Indexes and Performance

### Critical Indexes
```sql
-- Performance-critical indexes for admin queries

-- AI Jobs queries (status, user, date)
CREATE INDEX CONCURRENTLY "AiValidationJob_status_createdAt_idx" 
    ON "AiValidationJob"("status", "createdAt" DESC);
CREATE INDEX CONCURRENTLY "AiValidationJob_userId_status_idx" 
    ON "AiValidationJob"("userId", "status");

-- Question search indexes
CREATE INDEX CONCURRENTLY "Question_specialty_level_semester_idx" 
    ON "Question"("specialtyId", "level", "semester");
CREATE INDEX CONCURRENTLY "Question_type_active_validated_idx" 
    ON "Question"("type", "isActive", "isValidated");

-- User session analytics
CREATE INDEX CONCURRENTLY "UserSession_user_completed_idx" 
    ON "UserSession"("userId", "completedAt" DESC) 
    WHERE "status" = 'completed';

-- Question answer performance
CREATE INDEX CONCURRENTLY "UserQuestionAnswer_question_correct_idx" 
    ON "UserQuestionAnswer"("questionId", "isCorrect", "answeredAt");
```

### Query Optimization
```sql
-- Explain analyze for common admin queries

-- Get jobs with user info (used in admin dashboard)
EXPLAIN ANALYZE
SELECT j.*, u."name", u."email"
FROM "AiValidationJob" j
JOIN "User" u ON j."userId" = u."id"
WHERE j."status" IN ('processing', 'queued')
ORDER BY j."createdAt" DESC
LIMIT 50;

-- Get question statistics by specialty
EXPLAIN ANALYZE
SELECT 
    s."name" as specialty,
    COUNT(*) as total_questions,
    COUNT(CASE WHEN q."isValidated" = true THEN 1 END) as validated_questions
FROM "Question" q
JOIN "Specialty" s ON q."specialtyId" = s."id"
WHERE q."isActive" = true
GROUP BY s."id", s."name"
ORDER BY total_questions DESC;
```

## 🛡️ Data Integrity and Constraints

### Check Constraints
```sql
-- Question type validation
ALTER TABLE "Question" ADD CONSTRAINT "Question_type_check" 
    CHECK ("type" IN ('qcm', 'qroc', 'cas_qcm', 'cas_qroc'));

-- QCM questions must have options and correct answer
ALTER TABLE "Question" ADD CONSTRAINT "Question_qcm_fields_check" 
    CHECK (
        ("type" NOT LIKE '%qcm' OR 
         ("optionA" IS NOT NULL AND "optionB" IS NOT NULL AND "optionC" IS NOT NULL AND 
          "optionD" IS NOT NULL AND "optionE" IS NOT NULL AND "correctAnswer" IS NOT NULL))
    );

-- QROC questions must have answer
ALTER TABLE "Question" ADD CONSTRAINT "Question_qroc_fields_check" 
    CHECK (
        ("type" NOT LIKE '%qroc' OR "answer" IS NOT NULL)
    );

-- Correct answer validation for QCM
ALTER TABLE "Question" ADD CONSTRAINT "Question_correct_answer_check" 
    CHECK ("correctAnswer" IS NULL OR "correctAnswer" IN ('A', 'B', 'C', 'D', 'E'));

-- Progress percentage validation
ALTER TABLE "AiValidationJob" ADD CONSTRAINT "AiValidationJob_progress_check" 
    CHECK ("progress" >= 0 AND "progress" <= 100);

-- User role validation
ALTER TABLE "User" ADD CONSTRAINT "User_role_check" 
    CHECK ("role" IN ('admin', 'maintainer', 'user'));

-- Job status validation
ALTER TABLE "AiValidationJob" ADD CONSTRAINT "AiValidationJob_status_check" 
    CHECK ("status" IN ('queued', 'processing', 'completed', 'failed', 'cancelled'));
```

### Referential Integrity
```sql
-- Prevent deletion of specialty with questions
-- Already handled by ON DELETE RESTRICT in foreign key

-- Prevent deletion of user with active jobs
-- Already handled by ON DELETE CASCADE in foreign key

-- Ensure clinical cases only for case-based questions
CREATE OR REPLACE FUNCTION validate_clinical_case_assignment()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW."clinicalCaseId" IS NOT NULL AND NEW."type" NOT LIKE 'cas_%' THEN
        RAISE EXCEPTION 'Clinical case can only be assigned to case-based questions';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_clinical_case_trigger
    BEFORE INSERT OR UPDATE ON "Question"
    FOR EACH ROW
    EXECUTE FUNCTION validate_clinical_case_assignment();
```

## 🚀 Deployment and Maintenance

### Database Configuration
```sql
-- Production database settings
-- postgresql.conf recommendations

-- Connection settings
max_connections = 200
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
maintenance_work_mem = 64MB

-- Logging
log_statement = 'mod'
log_duration = on
log_min_duration_statement = 1000  -- Log slow queries

-- Performance
random_page_cost = 1.1  -- SSD storage
effective_io_concurrency = 200
```

### Backup Strategy
```bash
#!/bin/bash
# Database backup script

DB_NAME="medq_production"
BACKUP_DIR="/backups/postgres"
DATE=$(date +%Y%m%d_%H%M%S)

# Create full backup
pg_dump -h localhost -U postgres -d $DB_NAME \
    --clean --if-exists --create \
    -f "$BACKUP_DIR/medq_full_$DATE.sql"

# Create schema-only backup
pg_dump -h localhost -U postgres -d $DB_NAME \
    --schema-only \
    -f "$BACKUP_DIR/medq_schema_$DATE.sql"

# Compress backups
gzip "$BACKUP_DIR/medq_full_$DATE.sql"
gzip "$BACKUP_DIR/medq_schema_$DATE.sql"

# Clean old backups (keep 30 days)
find $BACKUP_DIR -name "medq_*.sql.gz" -mtime +30 -delete
```

### Monitoring Queries
```sql
-- Monitor database performance
-- Active connections
SELECT state, count(*) 
FROM pg_stat_activity 
WHERE datname = 'medq_production' 
GROUP BY state;

-- Slow queries
SELECT query, mean_exec_time, calls, total_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

This comprehensive database schema provides a robust foundation for the Medical Question Platform with proper relationships, constraints, and performance optimizations for the admin validation and import systems.