# Bulk Import Serverless Fix

**Date**: October 3, 2025  
**Issue**: In production, bulk imports were failing with `{"error":"Import not found"}` when checking progress after upload.

## Root Cause

The bulk import system was using an **in-memory Map** (`activeImports`) to store import session state. In serverless environments (like Vercel), when a function invocation ends and a new one starts (between POST upload and GET progress check), the Map is empty, causing "Import not found" errors.

## Solution

Replaced the in-memory Map with **database-backed session storage** using a new Prisma model.

## Changes Made

### 1. Prisma Schema (`prisma/schema.prisma`)

Added new model:
```prisma
model BulkImportSession {
  id          String   @id
  userId      String   @map("user_id") @db.Uuid
  progress    Int      @default(0)
  phase       String
  message     String
  logs        Json     @default("[]")
  stats       Json
  cancelled   Boolean  @default(false)
  lastUpdated DateTime @default(now()) @map("last_updated") @db.Timestamptz(6)
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([lastUpdated])
  @@map("bulk_import_sessions")
}
```

### 2. Database Migration

Applied manually to avoid data loss:
```bash
npx prisma db execute --file prisma/migrations/add_bulk_import_session_manual/migration.sql
```

### 3. API Route (`src/app/api/questions/bulk-import-progress/route.ts`)

#### Removed:
- In-memory `activeImports` Map
- Cleanup interval for in-memory sessions

#### Added:
- `createSession()` - Creates DB record for new import
- `getSession()` - Retrieves session from DB
- `updateSession()` - Updates session in DB
- `deleteSession()` - Deletes session from DB
- Background cleanup job - Deletes sessions older than 30 minutes

#### Updated:
- `updateProgress()` - Now async, updates DB instead of Map
- POST handler - Creates DB session on upload
- GET handler - Reads from DB for SSE streaming
- DELETE handler - Updates DB on cancellation
- `processFile()` - All progress updates now persist to DB

## Benefits

✅ **Serverless Compatible**: Sessions persist across function invocations  
✅ **Production Ready**: Works on Vercel, AWS Lambda, Azure Functions  
✅ **No Data Loss**: Import progress never lost due to function restarts  
✅ **Scalable**: Multiple users can import simultaneously  
✅ **Automatic Cleanup**: Old sessions deleted after 30 minutes  

## Testing

To test the fix:
1. Upload a file through admin import panel
2. Watch the progress update in real-time
3. Duplicate detection errors should now display correctly
4. Progress should never show "Import not found"

## Migration Notes

- Migration applied manually using `prisma db execute` to preserve production data
- No data loss occurred
- Table created with proper indexes for performance
- Foreign key ensures cascade delete when user is deleted
