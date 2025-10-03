# Stop Job API Fix

## Problem

When clicking the "Stop" button in the AI validation UI, users would encounter a server error:

```
TypeError: Request.formData: Could not parse content as FormData.
POST /api/validation/ai-progress?aiId=xxx&action=stop 500 in 170ms
```

## Root Cause

The `postHandler` function in `/api/validation/ai-progress/route.ts` was attempting to parse **all** POST requests as FormData, without checking the `action` parameter first.

- **File Upload Request**: `POST /api/validation/ai-progress` (body: FormData with file)
- **Stop Job Request**: `POST /api/validation/ai-progress?aiId=xxx&action=stop` (body: empty)

The stop request had an empty body, so `request.formData()` failed trying to parse it.

## Solution

Modified `postHandler` to check the `action` query parameter **before** attempting to parse FormData:

```typescript
async function postHandler(request: AuthenticatedRequest) {
  if (!isAzureConfigured()) return NextResponse.json({ error: 'AI not configured' }, { status: 400 });
  
  // Check for action parameter (e.g., action=stop)
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  
  // STOP ACTION: Stop a running job
  if (action === 'stop') {
    const aiId = searchParams.get('aiId');
    const userId = request.user?.userId;
    
    if (!aiId) return NextResponse.json({ error: 'aiId required' }, { status: 400 });
    
    try {
      // Remove from active sessions (stops further processing)
      const sess = activeAiSessions.get(aiId);
      if (sess) {
        sess.phase = 'error';
        sess.error = 'Arrêté par l\'utilisateur';
        sess.message = 'Job arrêté';
        sess.progress = 100;
        activeAiSessions.delete(aiId);
      }
      
      // Update DB record
      await prisma.aiValidationJob.updateMany({
        where: { id: aiId, userId },
        data: { 
          status: 'failed', 
          message: 'Arrêté par l\'utilisateur',
          progress: 100
        }
      });
      
      return NextResponse.json({ ok: true, message: 'Job arrêté' });
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'Erreur lors de l\'arrêt' }, { status: 500 });
    }
  }
  
  // Default: File upload and job creation
  const form = await request.formData();
  // ... rest of file upload logic
}
```

## What the Fix Does

1. **Early Action Check**: Checks if `action=stop` parameter exists before parsing FormData
2. **Stop Logic**: 
   - Removes session from `activeAiSessions` map (stops further processing)
   - Updates session state to `error` phase with user-friendly message
   - Updates database record to `failed` status
3. **FormData Parsing**: Only attempts to parse FormData if NOT a stop action

## Testing

To verify the fix works:

1. Upload an Excel file to start AI processing
2. While job is running, click the "Arrêter" (Stop) button
3. **Expected behavior**:
   - Toast notification: "Job arrêté"
   - Job status changes to "Erreur" 
   - No server errors in terminal
   - EventSource connection closes cleanly
4. **Terminal should show**:
   ```
   POST /api/validation/ai-progress?aiId=xxx&action=stop 200 in <X>ms
   ```

## Files Modified

- `src/app/api/validation/ai-progress/route.ts`: Added stop action handling in `postHandler`

## Related Features

This fix complements the auto-refresh toggle feature:
- **Auto-refresh toggle**: Controls EventSource connections and periodic polling
- **Stop button**: Terminates the AI job itself (server-side processing)

Both features work together to give users full control over AI validation jobs.

---

**Date**: October 3, 2025  
**Issue**: FormData parse error on stop action  
**Status**: ✅ Fixed
