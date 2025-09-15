// Central helper to log a user activity event; fire-and-forget with optional optimistic callback
export async function logActivity(type: string, onQueued?: () => void) {
  try {
    onQueued?.(); // allow optimistic UI update
    fetch('/api/user-activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type })
    }).catch(()=>{});
  } catch {}
}
