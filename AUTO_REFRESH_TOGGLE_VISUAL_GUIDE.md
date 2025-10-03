# 🎛️ AUTO-REFRESH TOGGLE - VISUAL GUIDE

## 📍 LOCATION 1: User Validation Page (PersistentAiJob Component)

```
┌────────────────────────────────────────────────────────┐
│  [File Upload Area]                                    │
│                                                        │
│  [Instructions Textarea]                               │
│                                                        │
│  [Fast Mode Toggle]                                    │
│                                                        │
│  [Créer un job IA Button]                            │
│                                                        │
│  ──────────────────────────────────────────────────── │
│                                                        │
│  Sessions Récentes                    [Auto] [🔄]    │ ← TOGGLE HERE!
│                                         │      │       │
│  ┌──────────────────────────────────┐  │      │       │
│  │ ✅ Complete • file.xlsx         │  │      │       │
│  │ ✅ 196 corrigées • 0 en erreur  │  │      │       │
│  │ 2/10/2025, 3:45 PM             │  │      │       │
│  └──────────────────────────────────┘  │      │       │
│                                         │      │       │
│  [Auto] = Auto-refresh ON (blue)       │      │       │
│  [Manuel] = Auto-refresh OFF (outline) │      │       │
│                                         │      │       │
│  [🔄] = Manual refresh button          │      │       │
└────────────────────────────────────────────────────────┘
```

**Button States:**

```
AUTO-REFRESH ON:
┌─────────┐
│ ⏸ Auto │  (Blue button with Pause icon)
└─────────┘

AUTO-REFRESH OFF:
┌────────────┐
│ ▶ Manuel  │  (Outline button with Play icon)
└────────────┘
```

---

## 📍 LOCATION 2: Admin Validation Page (Header)

```
┌────────────────────────────────────────────────────────────────┐
│  Validation des Questions                                      │
│  Système de validation classique et IA                         │
│                                                                │
│                      [Auto-refresh ON] [🔄 Actualiser]  ← HERE!│
│                       │                 │                       │
└────────────────────────────────────────────────────────────────┘
│                                         │                       │
│  ┌──────────────┐  ┌──────────────┐  ┌─│──────────┐           │
│  │ Total Jobs   │  │ Terminés     │  │ Actifs    │           │
│  │     42       │  │     38       │  │     2     │           │
│  └──────────────┘  └──────────────┘  └───────────┘           │
│                                                                │
│  [Validation Section]                                          │
└────────────────────────────────────────────────────────────────┘
```

**Button States:**

```
AUTO-REFRESH ON:
┌──────────────────────┐
│ ⏸ Auto-refresh ON   │  (Blue button)
└──────────────────────┘

AUTO-REFRESH OFF:
┌──────────────────────┐
│ ▶ Auto-refresh OFF  │  (Outline button)
└──────────────────────┘
```

---

## 🎨 VISUAL INDICATORS

### Color Coding:

**AUTO-REFRESH ENABLED (ON):**
- **User Page:** Blue button with "Auto" text
- **Admin Page:** Blue button with "Auto-refresh ON" text
- **Icon:** ⏸ (Pause icon) - indicates "running, can be paused"
- **Behavior:** Automatically polls for updates every 3-20 seconds

**AUTO-REFRESH DISABLED (OFF):**
- **User Page:** Outline button with "Manuel" text
- **Admin Page:** Outline button with "Auto-refresh OFF" text
- **Icon:** ▶ (Play icon) - indicates "paused, can be resumed"
- **Behavior:** NO automatic polling (manual refresh only)

---

## 🔄 STATE TRANSITIONS

```
     Click Toggle
┌──────────────┐        ┌──────────────┐
│   AUTO ON    │ ────►  │   AUTO OFF   │
│  (Polling)   │        │ (No Polling) │
└──────────────┘        └──────────────┘
       ▲                        │
       │      Click Toggle      │
       └────────────────────────┘
```

---

## 📊 NETWORK ACTIVITY

### WITH AUTO-REFRESH ON:
```
Browser Network Tab:
┌────────────────────────────────────────────┐
│ GET /api/validation/ai-progress?action=... │ 200 OK (134ms)
│ GET /api/validation/ai-progress?action=... │ 200 OK (138ms)
│ GET /api/validation/ai-progress?action=... │ 200 OK (142ms)
│ GET /api/validation/ai-progress?action=... │ 200 OK (135ms)
│ ... (continues every 3-20 seconds)         │
└────────────────────────────────────────────┘
```

### WITH AUTO-REFRESH OFF:
```
Browser Network Tab:
┌────────────────────────────────────────────┐
│ (No automatic requests)                    │
│                                            │
│ GET /api/validation/ai-progress?action=... │ 200 OK (145ms) ← Manual click
│                                            │
│ (Silence until next manual refresh)       │
└────────────────────────────────────────────┘
```

---

## 🎯 USE CASES

### When to ENABLE Auto-Refresh:
✅ Actively monitoring job progress  
✅ Waiting for a job to complete  
✅ Need real-time status updates  
✅ Multiple users working simultaneously  

### When to DISABLE Auto-Refresh:
✅ Debugging/inspecting network traffic  
✅ Reducing server load  
✅ Saving battery on laptop/mobile  
✅ Not actively monitoring (checking occasionally)  
✅ Working on other tasks  

---

## 💡 TIPS

1. **Default is ON:** Auto-refresh starts enabled to preserve existing behavior
2. **Per-Page:** Each page has its own toggle (user validation vs admin)
3. **Manual Always Works:** You can always manually refresh even when auto is off
4. **Visual Feedback:** Button color/text changes immediately
5. **Console Logs:** Check browser console for polling activity logs

---

## 🧪 QUICK TEST

**To verify it's working:**

1. Open browser Developer Tools (F12)
2. Go to **Network** tab
3. Filter by: `ai-progress`
4. Watch the requests:
   - **Toggle ON:** Should see requests every 3-20 seconds
   - **Toggle OFF:** Requests stop immediately
   - **Manual Refresh:** Single request when clicked

---

**Ready to use!** 🎉
