# Progression and Grouping: Clinical vs Multi (PCEM/DCEM)

This document explains the new, niveau-aware grouping and navigation behavior across the app, and highlights related UI/UX updates for creation, editing, and organization.

## Overview

We support three logical sections in navigation:
- QCM (single QCM + Multi QCM)
- QROC (single QROC + Multi QROC)
- Cas Cliniques (true clinical cases)

Grouping and visibility are now driven by the speciality's niveau:
- PCEM 1 / PCEM 2 (preclinical):
  - True clinical cases are disabled.
  - Multi QCM and Multi QROC are available and grouped either by the same caseNumber or by identical caseText.
- DCEM 1 / 2 / 3 (non-preclinical):
  - Clinical cases are enabled. Any questions sharing the same caseText form a clinical case (mix QCM and QROC).
  - Multi QCM/QROC are still available via caseNumber-based grouping; they appear in QCM/QROC sections, not in Cas Cliniques.

## Runtime grouping (use-lecture.ts)

- Preclinical (PCEM 1/2):
  - No clinical cases. Group QCM/QROC into Multi blocks:
    - caseNumber groups (when > 1 question share the same caseNumber)
    - identical caseText groups (when > 1 question share the same caseText)
  - Un-grouped items remain as singles.
- Non-preclinical (DCEM 1/2/3):
  - Clinical cases form when multiple questions share the same caseText. Mixed types allowed (MCQ/QROC).
  - If a caseNumber exists for any question with a given caseText, it seeds the case number; otherwise, a synthetic case number is assigned.
  - Multi QCM/QROC groups still exist via caseNumber for base types without caseText; they stay in their base sections.

## Organizer (QuestionOrganizerDialog)

- Preclinical (PCEM 1/2):
  - Clinical column is hidden.
  - QROC column shows singles and grouped QROC blocks. Drag/drop to form or dissolve groups.
- Non-preclinical (DCEM 1/2/3):
  - Clinical column is visible and includes:
    - clinic_* questions
    - Base MCQ/QROC with caseText (coerced visually to clinic_*), grouped by caseNumber or identical caseText (synthetic case numbers assigned per unique caseText when missing).
  - Those base items are excluded from MCQ/QROC columns to avoid duplicates.
  - Drag/drop supports:
    - Moving questions within a clinical case
    - Converting items between clinical and base columns (with confirmation)
    - Dissolving a whole clinical case to base types by dragging it to MCQ/QROC

## Creation dialog (CreateQuestionDialog)

- PCEM 1/2 (preclinical):
  - Clinical case creation is disabled, with a hint explaining to use Multi QCM/QROC.
  - Multi QROC creation persists the group’s common text as caseText (like Multi QCM) so text-based grouping works in runtime.
- DCEM 1/2/3:
  - Clinical case creation enabled (true Cas Cliniques).
  - Multi QCM/QROC still available:
    - To keep a Multi block out of clinicals, use a caseNumber and leave caseText empty (or unique).

## Navigation (QuestionControlPanel)

- Sections: QCM, QROC, and a separate Cas Cliniques block.
- Multi QCM/QROC (base groups) appear within their respective sections.
- Clinical cases appear only under Cas Cliniques.
- Visual indicators for grouped entries show the group size (e.g., 3×).

## Admin flows and safeguards

- Organizer enforces niveau rules (clinical column hidden in PCEM 1/2).
- Creation dialog blocks “Cas clinique (multi)” in PCEM 1/2.
- Type conversions warn about data loss (e.g., options when converting to QROC).
- Save path normalizes types in PCEM 1/2, preventing clinic_* from being persisted there.

## Edge cases and notes

- Normalization: caseText is trimmed before grouping. If you need stronger normalization (e.g., collapsing whitespace or stripping HTML), consider enhancing the normalizer in `use-lecture.ts` and organizer.
- Synthetic case numbers start at 100000 to avoid clashing with real caseNumber values.
- Single-item groups fallback to singles for a smoother UX (only groups with > 1 are promoted).

## Quick QA checklist

- PCEM lecture:
  - Verify “Cas Cliniques” section is hidden (navigator + organizer).
  - Create Multi QCM and Multi QROC with identical caseText → ensure grouped blocks appear in QCM/QROC.
  - Clinical type is blocked in the creation dialog.
- DCEM lecture:
  - Create mixed MCQ/QROC sharing the same caseText → ensure they show as one clinical case under “Cas Cliniques”, not in base QCM/QROC.
  - Create a Multi QCM/QROC with a caseNumber and no common caseText → appears as a grouped block under QCM/QROC.

## How to keep Multi vs Clinical in DCEM

- Prefer clinical (true case): give items the same caseText (and optionally a caseNumber).
- Prefer Multi (base group): use caseNumber and leave caseText empty or distinct.

## Implementation reference

- Runtime grouping: `src/hooks/use-lecture.ts`
- Organizer UI and save logic: `src/components/questions/QuestionOrganizerDialog.tsx`
- Creation dialog: `src/components/questions/CreateQuestionDialog.tsx`
- Navigator: `src/components/lectures/QuestionControlPanel.tsx`
