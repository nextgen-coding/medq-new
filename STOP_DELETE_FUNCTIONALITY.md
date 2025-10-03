# Stop and Delete Functionality for AI Validation Jobs

## Overview

This document describes the implementation of job control functionality for AI validation jobs, allowing users to:
- **Stop** running jobs to cancel execution
- **Delete** completed or failed jobs to remove from history

## Features

### 1. Stop Running Jobs
- **When**: Available for jobs with `phase === 'running'` or `phase === 'queued'`
- **What**: Cancels the AI processing job before completion
- **How**: Sends POST request to backend, closes SSE connections, updates status to 'error'
- **UI**: Orange-colored "Stop" button with StopCircle icon

### 2. Delete Completed Jobs
- **When**: Available for jobs with `phase === 'complete'` or `phase === 'error'`
- **What**: Removes job from database and session history
- **How**: Sends DELETE request to backend, removes from active sessions
- **UI**: Red "Delete" button with Trash2 icon

## Backend Implementation

### API Endpoints

#### Stop Job - `POST /api/validation/ai-progress?aiId={id}&action=stop`
```typescript
// Handler checks:
// 1. Session exists in activeAiSessions
// 2. User owns the session
// 3. Session is not already complete/error
// 4. Updates session phase to 'error'
// 5. Updates database status to 'failed'
// 6. Removes from activeAiSessions after 2s delay (allows SSE propagation)

Response: { ok: true, message: 'Job stopped successfully' }
```

#### Delete Job - `DELETE /api/validation/ai-progress?aiId={id}`
```typescript
// Handler checks:
// 1. User owns the session
// 2. Deletes from database
// 3. Removes from activeAiSessions immediately

Response: { ok: true }
```

### Files Modified

**`src/app/api/validation/ai-progress/route.ts`**

1. **Added stopHandler function** (lines ~1223-1278):
   - Validates session exists and user owns it
   - Checks phase is running/queued (not complete/error)
   - Updates session to error phase with "Arrêté par l'utilisateur" message
   - Updates database with failed status
   - Delays removal from activeAiSessions by 2 seconds to allow SSE propagation
   - Returns success response

2. **Updated postHandler** (lines ~1180-1188):
   - Added check for `action=stop` query parameter
   - Routes to stopHandler when action is 'stop'
   - Maintains existing file upload logic for regular POST requests

## Frontend Implementation

### State Management

**New State Variables**:
```typescript
const [stoppingId, setStoppingId] = useState<string | null>(null);
```

### Functions

#### stopJob()
```typescript
const stopJob = async (id: string) => {
  setStoppingId(id);
  try {
    // POST request with action=stop
    const resp = await fetch(
      `/api/validation/ai-progress?aiId=${encodeURIComponent(id)}&action=stop`, 
      { method: 'POST' }
    );
    
    if (!resp.ok) {
      throw new Error('Arrêt échoué');
    }
    
    // Close SSE connections if this is current/details session
    if (currentSession?.id === id && eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    if (detailsJobId === id && detailsEventRef.current) {
      detailsEventRef.current.close();
      detailsEventRef.current = null;
    }
    
    // Refresh sessions and details
    await loadRecentSessions();
    if (detailsJobId === id) {
      // Refresh details to show stopped state
      const r = await fetch(`/api/validation/ai-progress?aiId=${id}&action=details`);
      if (r.ok) {
        const d = await r.json();
        setDetailsData(d);
      }
    }
    
    toast.success('Job arrêté', {
      description: 'Le traitement a été interrompu'
    });
  } catch (e: any) {
    toast.error('Erreur arrêt', { description: e?.message });
  } finally {
    setStoppingId(null);
  }
};
```

### UI Components

#### Current Session Display (Above "Créer un job IA" button)

**Stop Button for Active Job**:
```tsx
{currentSession && currentSession.phase === 'running' && (
  <div className="border rounded-lg p-4 bg-medblue-50 dark:bg-medblue-900/20">
    <div className="flex items-center justify-between gap-2 mb-2">
      <div className="flex items-center gap-2">
        <StatusBadge phase={currentSession.phase} />
        <span className="text-sm font-medium">En cours de traitement...</span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => stopJob(currentSession.id)}
        disabled={stoppingId === currentSession.id}
        className="h-7 border-orange-200 hover:bg-orange-50 
                   dark:border-orange-800 dark:hover:bg-orange-900/20"
        title="Arrêter le traitement"
      >
        {stoppingId === currentSession.id ? (
          <span className="h-3 w-3 rounded-full border-2 border-orange-600 
                           border-t-transparent animate-spin" />
        ) : (
          <>
            <StopCircle className="h-3.5 w-3.5 mr-1 text-orange-600" />
            <span className="text-xs">Arrêter</span>
          </>
        )}
      </Button>
    </div>
    {/* Progress bar and stats... */}
  </div>
)}
```

#### Recent Sessions List

**Conditional Button Rendering**:
```tsx
{(session.phase === 'running' || session.phase === 'queued') ? (
  <Button
    variant="outline"
    size="sm"
    onClick={() => stopJob(session.id)}
    className="h-8 w-8 p-0 border-orange-200 hover:bg-orange-50 
               dark:border-orange-800 dark:hover:bg-orange-900/20"
    title="Arrêter"
    disabled={stoppingId === session.id}
  >
    {stoppingId === session.id ? (
      <span className="h-3 w-3 rounded-full border-2 border-orange-600 
                       border-t-transparent animate-spin" />
    ) : (
      <StopCircle className="h-4 w-4 text-orange-600" />
    )}
  </Button>
) : (
  <Button
    variant="destructive"
    size="sm"
    onClick={() => setConfirmDeleteId(session.id)}
    className="h-8 w-8 p-0"
    title="Supprimer"
    disabled={deletingId === session.id}
  >
    {deletingId === session.id ? (
      <span className="h-3 w-3 rounded-full border-2 border-white 
                       border-t-transparent animate-spin" />
    ) : (
      <Trash2 className="h-4 w-4" />
    )}
  </Button>
)}
```

#### Details Dialog

**Stop Button for Running Jobs**:
```tsx
{(detailsData?.phase === 'running' || detailsData?.phase === 'queued') && (
  <Button 
    size="sm" 
    variant="outline" 
    onClick={() => detailsData && stopJob(detailsData.id)}
    disabled={stoppingId === detailsData?.id}
    className="border-orange-200 hover:bg-orange-50 
               dark:border-orange-800 dark:hover:bg-orange-900/20"
  >
    {stoppingId === detailsData?.id ? (
      <span className="h-3 w-3 rounded-full border-2 border-orange-600 
                       border-t-transparent animate-spin mr-1" />
    ) : (
      <StopCircle className="h-4 w-4 mr-1 text-orange-600" />
    )}
    Arrêter
  </Button>
)}
```

### Files Modified

**`src/components/validation/PersistentAiJob.tsx`**

1. **Added StopCircle import** (line ~18):
   ```typescript
   import { StopCircle } from 'lucide-react';
   ```

2. **Added stoppingId state** (line ~77):
   ```typescript
   const [stoppingId, setStoppingId] = useState<string | null>(null);
   ```

3. **Added stopJob function** (lines ~319-361):
   - Handles stop API call
   - Closes SSE connections
   - Clears currentSession state when stopping active job
   - Refreshes session list and details
   - Shows success/error toasts
   - Manages loading state

4. **Added stop button to current session display** (lines ~540-565):
   - Shows stop button next to "En cours de traitement..." header
   - Inline button with orange styling
   - Displays while job is running
   - Clears current session UI when stopped

5. **Updated recent sessions button** (lines ~638-660):
   - Conditional rendering based on phase
   - Stop button for running/queued jobs (orange)
   - Delete button for complete/error jobs (red)

6. **Updated details dialog buttons** (lines ~749-771):
   - Added Stop button for running/queued jobs
   - Maintained Download button for complete jobs
   - Both use disabled state during operations

## UI Design

### Button Styles

#### Stop Button (Running Jobs)
- **Color**: Orange (`text-orange-600`, `border-orange-200`)
- **Hover**: Light orange background (`hover:bg-orange-50`)
- **Dark Mode**: Dark orange (`dark:border-orange-800`, `dark:hover:bg-orange-900/20`)
- **Icon**: `StopCircle` from lucide-react
- **Loading**: Orange spinner
- **Label**: "Arrêter" (in details dialog)

#### Delete Button (Completed Jobs)
- **Variant**: `destructive` (red)
- **Icon**: `Trash2` from lucide-react
- **Loading**: White spinner
- **Label**: "Supprimer" (title attribute)

### Visual States

#### Current Session (Active Job Display)
```
┌─────────────────────────────────────────────────┐
│ 🔵 En cours  En cours de traitement... [🟠 Stop]│
│ ████████████████████░░░░░░░░░░░░░░░░░  45%     │
│ Analyse IA...                                   │
│ 1/2 lots traités                                │
│ 📝 98 MCQ • 📋 50 QROC • Total: 148            │
└─────────────────────────────────────────────────┘
```

#### Recent Sessions List
```
┌─────────────────────────────────────────────────┐
│ Session: test.xlsx                              │
│ Status: En cours...                             │
│ Progress: 45%                                   │
│                                      [🟠 Stop]  │ ← Orange stop button
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Session: completed.xlsx                         │
│ Status: Terminé                                 │
│ Progress: 100%                                  │
│                                    [🔴 Delete]  │ ← Red delete button
└─────────────────────────────────────────────────┘
```

#### Details Dialog
```
┌─────────────────────────────────────────────────┐
│ Détails Job test.xlsx                           │
│                        [🟠 Arrêter] [Fermer]    │ ← Running job
│ ...                                             │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Détails Job completed.xlsx                      │
│              [📥 Télécharger] [Fermer]          │ ← Completed job
│ ...                                             │
└─────────────────────────────────────────────────┘
```

## User Flow

### Stopping a Running Job

1. User sees running job in sessions list with orange "Stop" button
2. User clicks Stop button
3. Button shows orange spinner, disabled state
4. Frontend:
   - Sends POST to `/api/validation/ai-progress?aiId={id}&action=stop`
   - Closes SSE connections
   - Shows loading state
5. Backend:
   - Validates session ownership
   - Updates phase to 'error' with "Arrêté par l'utilisateur" message
   - Updates database status to 'failed'
   - Removes from activeAiSessions (after 2s delay)
6. Frontend:
   - Receives success response
   - Refreshes session list
   - Shows success toast: "Job arrêté - Le traitement a été interrompu"
   - Button returns to normal state
7. Session now appears as failed/error and shows red Delete button

### Deleting a Completed Job

1. User sees completed/error job with red "Delete" button
2. User clicks Delete button
3. Confirmation dialog appears: "Confirmer la suppression"
4. User confirms deletion
5. Frontend:
   - Sends DELETE to `/api/validation/ai-progress?aiId={id}`
   - Shows loading state
6. Backend:
   - Validates session ownership
   - Deletes from database
   - Removes from activeAiSessions
7. Frontend:
   - Receives success response
   - Removes from session list (optimistic update)
   - Shows success toast: "Job supprimé"
   - If details dialog was open for this job, closes it

## Error Handling

### Stop Errors

**Session Not Found**:
```json
{ "error": "Session not found or already completed" }
Status: 404
```

**Unauthorized**:
```json
{ "error": "Unauthorized" }
Status: 403
```

**Already Complete**:
```json
{ "error": "Cannot stop completed or failed job" }
Status: 400
```

### Delete Errors

**Not Found**:
```json
{ "error": "not found" }
Status: 404
```

**Generic Error**:
```json
{ "error": "delete failed" }
Status: 500
```

## Technical Details

### SSE Connection Management

When stopping a job:
1. **Current Session**: If the stopped job is the currently active session, close `eventSourceRef.current`
2. **Details View**: If the stopped job is open in details dialog, close `detailsEventRef.current`
3. **Cleanup**: Both references set to `null` after closing

### Database Updates

**Stop Operation**:
```typescript
await prisma.aiValidationJob.update({
  where: { id: aiId },
  data: {
    status: 'failed',
    message: 'Arrêté par l\'utilisateur',
    updatedAt: new Date()
  }
});
```

**Delete Operation**:
```typescript
await prisma.aiValidationJob.delete({ 
  where: { id: aiId } 
});
```

### Timing Considerations

**Stop Handler Delay**:
- 2-second delay before removing from `activeAiSessions`
- Allows SSE connections to receive final state update
- Ensures clients see "stopped" message before connection closes

**Immediate Update**:
- Session phase updated immediately to 'error'
- Database updated immediately
- UI refreshes immediately after API response

## Testing Checklist

- [ ] Stop button appears in current session display for running jobs
- [ ] Stop button in current session clears the display when clicked
- [ ] Stop button appears only for running/queued jobs in sessions list
- [ ] Delete button appears only for complete/error jobs
- [ ] Stop button disabled during stop operation (shows spinner)
- [ ] Delete button disabled during delete operation (shows spinner)
- [ ] Stop operation closes SSE connections
- [ ] Stop operation updates database status to 'failed'
- [ ] Stop operation shows success toast with appropriate message
- [ ] Delete operation removes job from list
- [ ] Delete operation closes details dialog if open for that job
- [ ] Delete confirmation dialog works correctly
- [ ] Error messages displayed for failed operations
- [ ] Orange styling applied to stop button
- [ ] Red styling applied to delete button
- [ ] Both operations respect user ownership (can't stop/delete others' jobs)
- [ ] Stopped jobs can be deleted afterward
- [ ] Multiple jobs can be stopped/deleted in sequence

## Known Limitations

1. **No Undo**: Stopped jobs cannot be resumed; they must be re-uploaded
2. **Partial Results**: Stopped jobs don't preserve partial AI processing results
3. **Race Conditions**: If job completes while stop request is in flight, stop may fail with "Cannot stop completed job"
4. **Background Cleanup**: Stopped jobs remain in database as 'failed' status until explicitly deleted

## Future Enhancements

1. **Pause/Resume**: Allow pausing jobs and resuming from checkpoint
2. **Partial Export**: Export partially processed results before stopping
3. **Bulk Operations**: Stop/delete multiple jobs at once
4. **Auto-cleanup**: Automatically delete failed jobs after X days
5. **Stop Confirmation**: Add confirmation dialog for stop operation (similar to delete)
6. **Progress Preservation**: Save progress checkpoints for resumable stops

## Conclusion

The stop/delete functionality provides users with complete control over AI validation jobs:
- **Stop**: Immediate cancellation of running jobs with proper cleanup
- **Delete**: Clean removal of completed/failed jobs from history
- **Clear UI**: Visual distinction through color coding (orange = stop, red = delete)
- **Safe Operations**: Ownership validation and confirmation dialogs prevent accidental actions
