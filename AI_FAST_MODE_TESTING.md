# 🧪 AI Fast Mode Testing Guide

## Quick Test Plan

### Test 1: UI Rendering
**Objective**: Verify toggle appears and functions correctly

1. Navigate to `/admin/validation`
2. Look for "Mode Rapide IA" section
3. Verify default state shows:
   - Badge: "⚡ Activé"
   - Toggle: Blue background, knob on right
   - Description: "Traitement ultra-rapide (2-3 secondes...)"

**Expected Result**: ✅ Toggle visible with Fast Mode ON by default

---

### Test 2: Toggle Interaction
**Objective**: Verify clicking toggle changes state

**Steps**:
1. Click the toggle switch
2. Observe visual changes:
   - Badge changes to "🔄 Qualité Max"
   - Toggle becomes gray, knob moves left
   - Description changes to "Traitement avec amélioration (12-33 secondes...)"
3. Click again
4. Verify it returns to Fast Mode state

**Expected Result**: ✅ Toggle switches smoothly between states

---

### Test 3: Fast Mode Processing
**Objective**: Verify Fast Mode skips enhancement pass

**Preparation**:
1. Create a test Excel file with ~50-100 questions
2. Ensure toggle is ON (Fast Mode)

**Steps**:
1. Upload test file
2. Click "Créer un job IA"
3. Watch processing logs
4. Time the processing duration

**Expected Results**:
- ✅ Processing completes in 2-5 seconds
- ✅ Logs show: "⚡ FAST_MODE enabled, skipping enhancement"
- ✅ Progress bar doesn't get stuck at 90%
- ✅ Final Excel file downloads successfully

**Console Logs to Look For**:
```
📦 Processing batch 1/2 • mode=batch (batch=50, conc=50)
📦 Processing batch 2/2 • mode=batch (batch=50, conc=50)
🧩 Fusion des résultats…
⚡ FAST_MODE enabled, skipping enhancement  ← KEY LOG
✅ IA terminée
```

---

### Test 4: Quality Mode Processing
**Objective**: Verify Quality Mode runs enhancement pass

**Preparation**:
1. Use same test Excel file
2. Toggle OFF (Quality Mode)

**Steps**:
1. Upload test file
2. Click "Créer un job IA"
3. Watch processing logs
4. Time the processing duration

**Expected Results**:
- ✅ Processing takes 12-30+ seconds
- ✅ Logs show enhancement pass running
- ✅ Progress gets to 90%, then continues (enhancement phase)
- ✅ Final Excel file has enhanced explanations

**Console Logs to Look For**:
```
📦 Processing batch 1/2 • mode=batch (batch=50, conc=50)
📦 Processing batch 2/2 • mode=batch (batch=50, conc=50)
🧩 Fusion des résultats…
🐌 Running enhancement pass for X questions...  ← KEY LOG
⏳ This will make ANOTHER set of API calls...
✅ Enhanced X questions
✅ IA terminée
```

---

### Test 5: FormData Transmission
**Objective**: Verify fastMode parameter is sent correctly

**Steps**:
1. Open browser DevTools → Network tab
2. Upload a file with Fast Mode ON
3. Click "Créer un job IA"
4. Find the POST request to `/api/validation/ai-progress`
5. Check Form Data payload

**Expected Result**: ✅ Form Data includes `fastMode: "1"`

**With Fast Mode OFF**:
- ✅ Form Data includes `fastMode: "0"`

---

### Test 6: Session Storage
**Objective**: Verify fastMode is stored in session

**Steps**:
1. Create a job with Fast Mode ON
2. Check server logs or database
3. Verify session has `fastMode: true`

**Server-side verification**:
```typescript
// In runAiSession function
console.log('Session fastMode:', session.fastMode); // Should log true/false
```

---

### Test 7: Environment Variable Fallback
**Objective**: Verify env var still works as fallback

**Preparation**:
1. Remove any AI_FAST_MODE from .env (or set to 0)
2. Toggle is OFF in UI
3. Don't select any file (no UI preference)

**Steps**:
1. Manually call API with no fastMode parameter
2. Check which mode is used

**Expected Result**: ✅ Falls back to environment variable or default behavior

---

### Test 8: Quality Comparison
**Objective**: Compare output quality between modes

**Preparation**:
1. Prepare a test file with questions that have:
   - Complex medical scenarios
   - Multiple correct answers
   - Options requiring detailed explanations

**Steps**:
1. Process file with Fast Mode ON
2. Download result → Save as "result_fast.xlsx"
3. Process SAME file with Quality Mode OFF
4. Download result → Save as "result_quality.xlsx"
5. Compare explanation lengths and detail

**Expected Results**:
- ✅ Fast Mode: Most explanations 2-4 sentences, some with fallback
- ✅ Quality Mode: All explanations 3-6 sentences, enhanced
- ✅ Both have correct answers
- ✅ Quality Mode has ~5-10% longer explanations on average

---

### Test 9: Multiple Concurrent Jobs
**Objective**: Verify each job respects its own fastMode setting

**Steps**:
1. Create Job A with Fast Mode ON
2. While Job A is running, create Job B with Quality Mode OFF
3. Watch both process

**Expected Results**:
- ✅ Job A completes quickly (2-5 seconds)
- ✅ Job B takes longer (12-30 seconds)
- ✅ Jobs don't interfere with each other

---

### Test 10: Dark Mode Compatibility
**Objective**: Verify UI looks good in dark mode

**Steps**:
1. Toggle system/browser to dark mode
2. Check Admin Validation page
3. Verify toggle section colors

**Expected Results**:
- ✅ Text is readable (light blue on dark background)
- ✅ Toggle visible and functional
- ✅ Badge colors appropriate for dark mode
- ✅ No visual glitches or contrast issues

---

## Performance Benchmarks

### Fast Mode (Expected)
| Questions | Time | API Calls | Cost |
|-----------|------|-----------|------|
| 50 | 1-2s | 1 | $0.0003 |
| 100 | 2-3s | 2 | $0.0006 |
| 500 | 10-15s | 10 | $0.003 |

### Quality Mode (Expected)
| Questions | Time | API Calls | Cost |
|-----------|------|-----------|------|
| 50 | 6-15s | 2 | $0.0004 |
| 100 | 12-33s | 3 | $0.0008 |
| 500 | 60-165s | 15 | $0.004 |

---

## Troubleshooting

### Issue: Toggle doesn't appear
**Possible Causes**:
- Component not updated
- Page cache

**Solution**:
1. Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
2. Clear browser cache
3. Restart dev server

---

### Issue: Fast Mode still slow
**Debug Steps**:
1. Check browser Network tab → Verify `fastMode: "1"` in form data
2. Check server logs → Should see "⚡ FAST_MODE enabled"
3. Check session object → Should have `fastMode: true`

**Possible Causes**:
- Form data not being sent
- Backend not reading fastMode parameter
- Session not storing fastMode

---

### Issue: Quality Mode doesn't enhance
**Debug Steps**:
1. Check browser Network tab → Verify `fastMode: "0"` in form data
2. Check server logs → Should see "🐌 Running enhancement pass"
3. Verify enhanceTargets array has items

**Possible Causes**:
- All explanations were already good (rare)
- Enhancement function not called
- Session fastMode is incorrectly true

---

### Issue: Toggle state doesn't persist
**Expected Behavior**: State should reset on page refresh (this is intentional)
**Workaround**: Set default in component if persistence is needed

---

## Success Criteria

All tests should pass with these outcomes:

- ✅ Toggle renders and responds to clicks
- ✅ Fast Mode processes in 2-5 seconds for 100 questions
- ✅ Quality Mode processes in 12-30 seconds for 100 questions
- ✅ Form data includes fastMode parameter
- ✅ Server logs show correct mode being used
- ✅ Enhancement pass is skipped in Fast Mode
- ✅ Enhancement pass runs in Quality Mode
- ✅ Both modes produce correct answers
- ✅ Quality Mode has slightly better explanations
- ✅ UI is accessible and works in dark mode

---

## Quick Verification Script

```bash
# 1. Start dev server
npm run dev

# 2. Open browser to http://localhost:3000/admin/validation

# 3. Check for these elements:
#    - "Mode Rapide IA" section
#    - Toggle switch (blue = ON, gray = OFF)
#    - Badge showing "⚡ Activé" or "🔄 Qualité Max"

# 4. Upload a test file and process

# 5. Monitor terminal for logs confirming mode
```

---

**Status**: Ready for testing! 🧪

All tests should pass if implementation is correct. Report any issues found during testing.
