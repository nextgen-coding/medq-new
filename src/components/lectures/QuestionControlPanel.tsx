
import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Question, ClinicalCase } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronLeft, ChevronRight, CheckCircle, Circle, XCircle, MinusCircle, Stethoscope, EyeOff, StickyNote, Pin, Flag, Pencil, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
// Replaced Vaul Drawer (infinite update loop on some setups) with a simple custom sheet
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganizer } from '@/contexts/OrganizerContext';

type ColumnKey = 'mcq' | 'qroc' | 'clinical';

interface OrganizerEntry {
  id: string;
  type: string;
  text: string;
  number?: number;
  caseNumber?: number;
  originalIndex: number;
}

interface QuestionControlPanelProps {
  questions: (Question | ClinicalCase)[];
  currentQuestionIndex: number;
  answers: Record<string, any>;
  answerResults?: Record<string, boolean | 'partial'>;
  onQuestionSelect: (index: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  isComplete: boolean;
  pinnedIds?: string[]; // optional list of pinned question IDs
  organizerState?: Record<ColumnKey, OrganizerEntry[]> | null; // optional organizer override
  onQuit?: () => void; // optional quit handler
  mode?: string | null; // mode to determine display behavior
}

export function QuestionControlPanel({
  questions,
  currentQuestionIndex,
  answers,
  answerResults = {},
  onQuestionSelect,
  onPrevious,
  onNext,
  isComplete,
  pinnedIds = [],
  organizerState,
  onQuit,
  mode
}: QuestionControlPanelProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isOrganizerOpen, organizerState: contextOrganizerState } = useOrganizer();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [notesMap, setNotesMap] = useState<Record<string, boolean>>({});
  
  // Use organizer state from context if available, otherwise use prop
  const activeOrganizerState = contextOrganizerState || organizerState;
  
  // Refs to track question buttons for auto-scrolling
  const questionRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const lastScrolledIndex = useRef<number>(-1);
  const hasInitiallyScrolled = useRef<boolean>(false);
  const [lastPinTime, setLastPinTime] = useState(0);
  const savedScrollPosition = useRef<number>(0);
  const prefersReducedMotion = useReducedMotion();
  const pendingScrollRaf = useRef<number | null>(null);
  const isProgrammaticScrolling = useRef<boolean>(false);
  const scrollLockUntil = useRef<number>(0);

  // Resolve the actual scrollable viewport element from Radix ScrollArea
  const getScrollViewport = () => {
    if (!scrollAreaRef.current) return null;
    return (
      (scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null) ||
      (scrollAreaRef.current.querySelector('div > div') as HTMLElement | null) ||
      (scrollAreaRef.current as HTMLElement)
    );
  };

  // Compute an element's top relative to the scrollable viewport (not the window)
  const getRelativeTop = (el: HTMLElement, parent: HTMLElement): number => {
    let y = 0;
    let n: HTMLElement | null = el;
    while (n && n !== parent) {
      y += n.offsetTop;
      n = n.offsetParent as HTMLElement | null;
    }
    return y;
  };

  // On mount, disable browser scroll anchoring on the scroll viewport to avoid auto jumps
  useEffect(() => {
    const vp = getScrollViewport();
    if (vp) {
      // Prevent Chrome/Firefox from auto-adjusting scroll on DOM changes above
      (vp.style as any).overflowAnchor = 'none';
    }
  }, []);

  // Smoothly position an item into view with controlled easing
  const scrollItemIntoView = (index: number, behavior: ScrollBehavior) => {
    const viewport = getScrollViewport();
    const btn = questionRefs.current[index];
    if (!viewport || !btn) return;

    // Lock scrolling during animations to prevent interference
    const now = Date.now();
    if (now < scrollLockUntil.current) return;
    scrollLockUntil.current = now + 400; // 400ms lock for smooth animation

    try {
      // Cancel any pending scroll operations
      if (pendingScrollRaf.current) cancelAnimationFrame(pendingScrollRaf.current);
      
      // Use proper scheduling for smooth layout
      pendingScrollRaf.current = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          try {
            const padding = 20; // generous padding for smooth UX
            const visibleTop = viewport.scrollTop;
            const visibleBottom = visibleTop + viewport.clientHeight;
            const elTop = getRelativeTop(btn, viewport);
            const elBottom = elTop + btn.offsetHeight;
            const above = elTop < visibleTop + padding;
            const below = elBottom > visibleBottom - padding;

            if (!above && !below) return; // already visible

            isProgrammaticScrolling.current = true;

            // Calculate minimal target position within viewport coordinates
            let targetScroll: number | undefined;
            if (above) {
              targetScroll = elTop - padding;
            } else if (below) {
              targetScroll = elBottom - viewport.clientHeight + padding;
            }
            
            if (targetScroll !== undefined) {
              // Use smooth scrolling with custom easing
              viewport.scrollTo({ 
                top: Math.max(0, targetScroll), 
                behavior: prefersReducedMotion ? 'auto' : 'smooth'
              });
            }
            
            // Clear flags after animation completes
            setTimeout(() => { 
              isProgrammaticScrolling.current = false; 
              scrollLockUntil.current = 0;
            }, prefersReducedMotion ? 50 : 350);
          } catch {
            // Fallback with smooth behavior
            btn.scrollIntoView({ behavior, block: 'center', inline: 'nearest' });
          }
        });
      });
    } catch {
      btn.scrollIntoView({ behavior, block: 'center', inline: 'nearest' });
    }
  };

  // Listen for pin events to prevent unwanted scrolling
  useEffect(() => {
    const handlePinUpdate = () => {
      // Save current scroll position before pin update
      const viewport = getScrollViewport();
      if (viewport) savedScrollPosition.current = viewport.scrollTop;
      setLastPinTime(Date.now());
    };

    window.addEventListener('pinned-updated', handlePinUpdate);
    return () => window.removeEventListener('pinned-updated', handlePinUpdate);
  }, []);

  // Restore scroll position after pin updates
  useEffect(() => {
    const timeSincePinAction = Date.now() - lastPinTime;
    if (timeSincePinAction < 100 && savedScrollPosition.current > 0) {
      // Small delay to ensure DOM has updated
      const timeoutId = setTimeout(() => {
        const viewport = getScrollViewport();
        if (viewport) viewport.scrollTop = savedScrollPosition.current;
      }, 50);
      return () => clearTimeout(timeoutId);
    }
  }, [lastPinTime, pinnedIds]); // Include pinnedIds to trigger after pin state changes

  // Auto-scroll to current question when index changes (but not during pin actions)
  useEffect(() => {
    // Don't scroll if this is triggered right after a pin action (within 1000ms)
    const timeSincePinAction = Date.now() - lastPinTime;
    if (timeSincePinAction < 1000) return;
    
    // Only scroll if the index has actually changed
    if (lastScrolledIndex.current !== currentQuestionIndex) {
      const scrollToCurrentQuestion = () => {
        // Use smooth scrolling for navigation
        const behavior: ScrollBehavior = prefersReducedMotion ? 'auto' : 'smooth';
        scrollItemIntoView(currentQuestionIndex, behavior);
        lastScrolledIndex.current = currentQuestionIndex;
      };

      // Optimized delay for smooth rendering
      const timeoutId = setTimeout(scrollToCurrentQuestion, 80);
      return () => clearTimeout(timeoutId);
    }
  }, [currentQuestionIndex, lastPinTime]);

  // Initial scroll on component mount (for when page loads with existing progress)
  useEffect(() => {
    // Only do initial scroll once when questions are loaded
    if (questions.length > 0 && !hasInitiallyScrolled.current) {
      const scrollToCurrentQuestion = () => {
        // Use instant positioning on initial mount to avoid any startup jank
        scrollItemIntoView(currentQuestionIndex, 'auto');
        lastScrolledIndex.current = currentQuestionIndex;
        hasInitiallyScrolled.current = true;
      };

      // Optimized timing for initial positioning
      const animationFrame = requestAnimationFrame(() => {
        setTimeout(scrollToCurrentQuestion, 250);
      });
      
      return () => cancelAnimationFrame(animationFrame);
    }
  }, [questions.length, currentQuestionIndex]); // Include currentQuestionIndex for initial positioning
  
  // Build list of regular question IDs (exclude clinical case wrappers)
  const regularQuestionIds = useMemo(() => {
    const ids: string[] = [];
    questions.forEach((item) => {
      if (!('questions' in item)) {
        ids.push((item as Question).id);
      } else if (Array.isArray((item as any).questions) && (item as any).questions[0]) {
        // For clinical cases/groups, add the first sub-question's UUID
        ids.push((item as any).questions[0].id);
      }
    });
    return ids;
  }, [questions]);

  // Fetch whether the user has notes for each question (used to show a small notes icon)
  useEffect(() => {
    if (!user?.id || questions.length === 0) return;

    const controller = new AbortController();

    (async () => {
      try {
        // Build list of all possible note IDs to check
        const noteIdsToCheck: string[] = [];
        
        questions.forEach((item, index) => {
          if ('questions' in item && 'caseNumber' in item) {
            // Clinical case - always check for clinical-case-{caseNumber} notes
            const caseItem = item as ClinicalCase;
            noteIdsToCheck.push(`clinical-case-${caseItem.caseNumber}`);
            console.log('Task Navigator - Adding clinical case note check:', `clinical-case-${caseItem.caseNumber}`);
          } else {
            // Regular question - check for question ID notes
            const question = item as Question;
            noteIdsToCheck.push(question.id);
            console.log('Task Navigator - Adding regular question note check:', question.id);
          }
        });

        console.log('Task Navigator - All note IDs to check:', noteIdsToCheck);
        console.log('Task Navigator - Questions being processed:', questions.map(q => ({
          id: 'questions' in q ? `clinical-case-${q.caseNumber}` : (q as any).id,
          type: 'questions' in q ? 'clinicalCase' : (q as any).type,
          caseNumber: 'caseNumber' in q ? q.caseNumber : null
        })));

        console.log('Task Navigator - Checking notes for IDs:', noteIdsToCheck);

        const results = await Promise.all(
          noteIdsToCheck.map(async (id) => {
            try {
              // Determine which API to use based on question ID format
              const isClinicalCase = id.startsWith('clinical-case-') ||
                id.startsWith('group-qroc-') ||
                id.startsWith('group-qcm-') ||
                id.startsWith('group-mcq-');

              const apiUrl = isClinicalCase ? '/api/clinical-case-notes' : '/api/user-question-state';

              console.log(`Task Navigator - Checking notes for ${id}: using ${apiUrl}`);

              const res = await fetch(`${apiUrl}?userId=${encodeURIComponent(user.id)}&questionId=${encodeURIComponent(id)}`, {
                signal: controller.signal,
                cache: 'no-cache'
              });
              if (!res.ok) {
                return [id, false] as [string, boolean];
              }
              const data = await res.json();
              const hasNote = !!(data?.notes && String(data.notes).trim().length > 0);
              return [id, hasNote] as [string, boolean];
            } catch {
              return [id, false] as [string, boolean];
            }
          })
        );
        
        if (!controller.signal.aborted) {
          const newNotesMap: Record<string, boolean> = {};
          results.forEach(([id, hasNote]) => {
            newNotesMap[id] = hasNote;
          });
          console.log('Task Navigator - Initial notes fetch results:', results);
          console.log('Task Navigator - Setting initial notesMap:', newNotesMap);
          setNotesMap(newNotesMap);
        }
      } catch {
        // ignore fetch errors
      }
    })();

    return () => controller.abort();
  }, [user?.id, questions.length]); // Re-fetch when user or questions change

  // Listen for notes updates to refresh the notes map
  useEffect(() => {
    const handleNotesUpdate = (event: any) => {
      const { questionId, hasContent } = event.detail || {};
      console.log('Task Navigator - Received notes-updated event:', { questionId, hasContent, currentNotesMap: notesMap });
      if (questionId) {
        setNotesMap(prev => {
          const updated = {
            ...prev,
            [questionId]: hasContent
          };
          console.log('Task Navigator - Updated notesMap:', updated);
          return updated;
        });
      }
    };

    // Listen for custom events dispatched when notes are saved/cleared
    window.addEventListener('notes-updated', handleNotesUpdate);

    return () => {
      window.removeEventListener('notes-updated', handleNotesUpdate);
    };
  }, []); // Remove notesMap dependency to prevent unnecessary re-renders


  // Only show on mobile devices using a lightweight custom sheet (no portal)
  const MobileDrawer = () => (
    <>
      <Button
        onClick={() => setIsDrawerOpen(true)}
        variant="outline"
        className="fixed bottom-6 right-6 lg:hidden z-50 gap-2 shadow-xl backdrop-blur-sm bg-white/90 dark:bg-gray-900/90 border border-gray-200/60 dark:border-gray-700/60 hover:bg-blue-50 dark:hover:bg-blue-900/50 hover:border-blue-300 dark:hover:border-blue-600 rounded-xl"
      >
        <span className="font-medium">{t('questions.questions')}</span>
        <span className="text-xs bg-blue-600 dark:bg-blue-700 text-white rounded-full px-2 py-0.5 font-medium">
          {questions.length}
        </span>
      </Button>
      {isDrawerOpen && (
        <div className="lg:hidden">
          <div
            className="fixed inset-0 z-50 bg-black/60"
            onClick={() => setIsDrawerOpen(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-[60] h-[80vh] rounded-t-2xl border bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm shadow-2xl">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <h3 className="font-bold text-xl text-gray-900 dark:text-gray-100">{t('questions.questions')}</h3>
                <Button variant="ghost" size="sm" onClick={() => setIsDrawerOpen(false)}>Fermer</Button>
              </div>
              <ScrollArea ref={scrollAreaRef} className="h-[calc(80vh-180px)]">
                {renderQuestionsList()}
              </ScrollArea>
              {renderNavigationButtons()}
            </div>
          </div>
        </div>
      )}
    </>
  );

  // Desktop panel
  const DesktopPanel = () => (
    <Card className="hidden lg:block sticky top-6 h-fit max-h-[calc(100vh-8rem)] backdrop-blur-sm bg-white/90 dark:bg-gray-900/95 border border-gray-200/60 dark:border-gray-700/60 shadow-lg rounded-2xl">
      <CardContent className="p-6">
        <div className="flex items-start mb-3">
          <div className="flex items-start flex-1 min-w-0 gap-2 pr-2">
            <div className="flex items-center justify-center w-8 h-8 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex-shrink-0 mt-0.5">
              <Circle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0 leading-tight">
              <h3 className="font-bold text-[16.5px] sm:text-[17px] text-gray-900 dark:text-gray-100 truncate tracking-tight">{t('questions.navigator')}</h3>
              <p className="text-[11px] sm:text-[11.5px] text-gray-600 dark:text-gray-400">{questions.length} {questions.length === 1 ? 'question' : 'questions'}</p>
            </div>
          </div>
          {onQuit && (
            <Button
              onClick={onQuit}
              variant="destructive"
              size="sm"
              className="ml-auto bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 text-white rounded-lg flex-shrink-0 shadow-sm hover:shadow transition-colors duration-200 flex items-center gap-2 px-3 py-2 h-10"
            >
              <LogOut className="h-4 w-4" />
              <span className="font-medium">Quitter</span>
            </Button>
          )}
        </div>
        <ScrollArea ref={scrollAreaRef} className="h-[calc(100vh-20rem)]">
          {renderQuestionsList()}
        </ScrollArea>
        {renderNavigationButtons()}
      </CardContent>
    </Card>
  );

  const renderOrganizerBasedNavigation = () => {
    if (!activeOrganizerState) return null;

    const getTypeLabel = (key: ColumnKey) => {
      switch (key) {
        case 'mcq': return t('questions.mcq');
        case 'qroc': return 'QROC';
        case 'clinical': return 'Cas Cliniques';
      }
    };

    const getColumnIcon = (key: ColumnKey) => {
      switch (key) {
        case 'clinical': return <Stethoscope className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
        default: return <div className="w-2 h-2 bg-blue-500 rounded-full"></div>;
      }
    };

    const renderOrganizerButton = (entry: OrganizerEntry, displayNumber: number) => {
      let isAnswered = false;
      let isCorrect: boolean | 'partial' | undefined;
      let isCurrent = false;
      let actualIndex = entry.originalIndex;
      
      // For groups, find the actual index in the questions array and check group answers
      if (entry.originalIndex === -1 && entry.caseNumber) {
        // Find the ClinicalCase object with matching caseNumber
        const foundIndex = questions.findIndex(item => {
          if ('questions' in item && 'caseNumber' in item) {
            return (item as any).caseNumber === entry.caseNumber;
          }
          return false;
        });
        if (foundIndex !== -1) {
          actualIndex = foundIndex;
          // For groups, check if all questions in the group are answered
          const groupItem = questions[foundIndex];
          if ('questions' in groupItem) {
            const groupQuestions = (groupItem as any).questions;
            isAnswered = groupQuestions.every((q: any) => answers[q.id] !== undefined);
            
            // Calculate group result
            if (isAnswered) {
              const allCorrect = groupQuestions.every((q: any) => answerResults[q.id] === true);
              const someCorrect = groupQuestions.some((q: any) => answerResults[q.id] === true || answerResults[q.id] === 'partial');
              isCorrect = allCorrect ? true : (someCorrect ? 'partial' : false);
            }
          }
        }
      } else {
        // For single questions
        isAnswered = answers[entry.id] !== undefined;
        isCorrect = answerResults[entry.id];
      }
      
      isCurrent = actualIndex === currentQuestionIndex && !isComplete;
      // For clinical/group entries, check notesMap using the correct note ID format
      let hasNote = false;
      let noteId = '';
      if (entry.type === 'clinical') {
        // Clinical case uses clinical-case-{caseNumber}
        noteId = `clinical-case-${entry.caseNumber}`;
        hasNote = notesMap[noteId] === true;
      } else if (entry.type === 'group-qcm') {
        // Multi MCQ group uses group-qcm-{caseNumber}
        noteId = `group-qcm-${entry.caseNumber}`;
        hasNote = notesMap[noteId] === true;
      } else if (entry.type === 'group-qroc') {
        // Multi QROC group uses group-qroc-{caseNumber}
        noteId = `group-qroc-${entry.caseNumber}`;
        hasNote = notesMap[noteId] === true;
      } else {
        // Regular question uses question ID
        noteId = entry.id;
        hasNote = notesMap[entry.id] === true;
      }

      console.log('Task Navigator - Checking notes for entry:', { entryId: entry.id, entryType: entry.type, noteId, hasNote, notesMap: notesMap[noteId] });
      const isPinned = pinnedIds.includes(entry.id);

      return (
        <motion.div
          key={entry.id}
          layout
          initial={{ opacity: 0.8, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0.8, y: -3 }}
          transition={{ 
            type: 'spring', 
            stiffness: 300, 
            damping: 30, 
            mass: 0.8,
            opacity: { duration: 0.2 }
          }}
        >
          <Button
            ref={(el) => { 
              if (actualIndex >= 0) {
                questionRefs.current[actualIndex] = el; 
              }
            }}
            variant="outline"
            className={cn(
              "relative overflow-hidden w-full justify-start h-auto p-3 backdrop-blur-sm bg-white/90 dark:bg-gray-900/90 border border-gray-200/60 dark:border-gray-700/60 hover:bg-blue-50/70 dark:hover:bg-blue-900/30 hover:border-blue-300/80 dark:hover:border-blue-600/70 rounded-xl transition-colors duration-300 will-change-transform",
              isCurrent && "border-blue-500 dark:border-blue-400 bg-blue-50/80 dark:bg-blue-900/40 shadow-[0_6px_18px_-4px_rgba(0,0,0,0.18)]",
              isAnswered && !isCurrent && "bg-gray-50 dark:bg-gray-700/40"
            )}
            onClick={() => {
              if (actualIndex >= 0) {
                onQuestionSelect(actualIndex);
                setIsDrawerOpen(false);
              }
            }}
          >
            {/* Animated active glow */}
            {isCurrent && (
              <motion.div
                layoutId="active-glow"
                className="absolute inset-0 pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 120, damping: 24, mass: 0.9 }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/15 via-blue-400/10 to-blue-500/15" />
                <div className="absolute -inset-px rounded-xl ring-1 ring-blue-400/40 dark:ring-blue-500/30" />
              </motion.div>
            )}
            <div className="flex items-start w-full relative">
              <div className="flex flex-col items-start mr-3 flex-1 min-w-0">
                <span className="text-left text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 truncate w-full">
                  {entry.text}
                </span>
                <span className="text-left text-xs text-gray-600 dark:text-gray-400 truncate flex items-center gap-1 w-full">
                  {`${entry.type.toUpperCase()} ${displayNumber}`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {isPinned && (
                  <Pin className="h-4 w-4 text-pink-600 dark:text-pink-400" />
                )}
                {hasNote && (
                  <StickyNote className="h-4 w-4 text-yellow-500" />
                )}
                <motion.div
                  layout
                  className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700"
                  animate={isCurrent ? { 
                    opacity: 1, 
                    scale: 1.05,
                    boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.3)'
                  } : { 
                    opacity: 0.95, 
                    scale: 1,
                    boxShadow: '0 0 0 0px rgba(59, 130, 246, 0)'
                  }}
                  transition={{ 
                    type: 'spring', 
                    stiffness: 250, 
                    damping: 25,
                    boxShadow: { duration: 0.2 }
                  }}
                >
                  {mode === 'revision' ? (
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  ) : isAnswered ? (
                    isCorrect === true ? (
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                    ) : isCorrect === 'partial' ? (
                      <MinusCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                    )
                  ) : (
                    <Circle className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                  )}
                </motion.div>
              </div>
            </div>
          </Button>
        </motion.div>
      );
    };

    return (
      <div className="space-y-4">
        {(['mcq', 'qroc', 'clinical'] as ColumnKey[]).map(columnKey => {
          const columnEntries = activeOrganizerState[columnKey] || [];
          if (columnEntries.length === 0) return null;

          return (
            <div key={columnKey} className="space-y-3">
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50/50 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-700/50 rounded-xl">
                {getColumnIcon(columnKey)}
                <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                  {getTypeLabel(columnKey)} ({columnEntries.length})
                </span>
              </div>
              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {columnEntries.map((entry, index) => 
                    renderOrganizerButton(entry, index + 1)
                  )}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderQuestionsList = () => {
    // If organizer is open and has state, use that instead of automatic grouping
    if (isOrganizerOpen && activeOrganizerState) {
      return renderOrganizerBasedNavigation();
    }

    // Original automatic grouping logic
    // Group questions by type
    const regularQuestions: Array<Question & { originalIndex: number }> = [];
    const clinicalCases: Array<ClinicalCase & { originalIndex: number }> = [];
  const multiQrocGroups: Array<ClinicalCase & { originalIndex: number; multiQroc: boolean }> = [];
  const multiMcqGroups: Array<ClinicalCase & { originalIndex: number; multiMcq: boolean }> = [];

    // Classify questions: detect multi-QROC groups (ClinicalCase objects whose subquestions are all plain qroc)
    questions.forEach((item, index) => {
      if ('caseNumber' in item && 'questions' in item) {
        const caseItem = item as ClinicalCase;
          // Safety net: collapse single-question clinical wrappers (should have been unwrapped upstream)
          if (Array.isArray(caseItem.questions) && caseItem.questions.length === 1) {
            const solo = caseItem.questions[0] as any;
            regularQuestions.push({ ...(solo as Question), originalIndex: index });
            return; // skip adding as clinical case
          }
        const allQroc = Array.isArray(caseItem.questions) && caseItem.questions.length > 0 && caseItem.questions.every(q => (q as any).type === 'qroc');
        const allMcq = Array.isArray(caseItem.questions) && caseItem.questions.length > 0 && caseItem.questions.every(q => (q as any).type === 'mcq');
        if (allQroc) {
          multiQrocGroups.push({ ...caseItem, originalIndex: index, multiQroc: true });
        } else if (allMcq) {
          multiMcqGroups.push({ ...caseItem, originalIndex: index, multiMcq: true });
        } else {
          clinicalCases.push({ ...caseItem, originalIndex: index });
        }
      } else {
        const q = item as Question;
        regularQuestions.push({ ...q, originalIndex: index });
      }
    });

    console.log('Task Navigator - Classification results:', {
  regularQuestions: regularQuestions.length,
  multiQrocGroups: multiQrocGroups.length,
  multiMcqGroups: multiMcqGroups.length,
  clinicalCases: clinicalCases.length,
  questions: questions.map(q => ({
    id: 'questions' in q ? `clinical-case-${q.caseNumber}` : (q as any).id,
    type: 'questions' in q ? 'clinicalCase' : (q as any).type,
    caseNumber: 'caseNumber' in q ? q.caseNumber : null
  }))
});

    // We'll render multi QROC groups inside the QROC block instead of clinical cases

    // Group regular questions by type
    const groupedQuestions = regularQuestions.reduce((groups, question) => {
      const type = question.type;
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(question);
      return groups;
    }, {} as Record<string, Array<Question & { originalIndex: number }>>);

    // Inject synthetic multi-QROC navigation entries into qroc group
    if (multiQrocGroups.length) {
      if (!groupedQuestions['qroc']) groupedQuestions['qroc'] = [];
      multiQrocGroups.forEach(group => {
        groupedQuestions['qroc'].push({
          id: `multiqroc-${group.caseNumber}`,
          lectureId: group.questions[0].lectureId,
          lecture_id: group.questions[0].lectureId,
          type: 'qroc',
          text: `Groupe #${group.caseNumber}`,
          number: group.caseNumber,
          options: [],
          correct_answers: [],
          originalIndex: group.originalIndex as any,
          // embed subquestions so navigation can derive states (pin/hidden)
          questions: group.questions,
          hidden: group.questions.every(q => (q as any).hidden),
          meta: { multiQroc: true, total: group.totalQuestions }
        } as any);
      });
      groupedQuestions['qroc'].sort((a,b)=> (a.number||0)-(b.number||0));
    }


    // Inject synthetic multi-MCQ navigation entries into mcq group
    if (multiMcqGroups.length) {
      if (!groupedQuestions['mcq']) groupedQuestions['mcq'] = [];
      multiMcqGroups.forEach(group => {
        groupedQuestions['mcq'].push({
          id: `multimcq-${group.caseNumber}`,
          lectureId: (group.questions[0] as any).lectureId,
          lecture_id: (group.questions[0] as any).lectureId,
          type: 'mcq',
          text: `Groupe #${group.caseNumber}`,
          number: group.caseNumber,
          options: [],
          correct_answers: [],
          originalIndex: group.originalIndex as any,
          questions: group.questions,
          hidden: group.questions.every(q => (q as any).hidden),
          meta: { multiMcq: true, total: group.totalQuestions }
        } as any);
      });
      groupedQuestions['mcq'].sort((a,b)=> (a.number||0)-(b.number||0));
    }

    // Normalize ordering per type: sort by existing number then original index, then assign displayNumber sequentially
    Object.keys(groupedQuestions).forEach(type => {
      const arr = groupedQuestions[type];
      arr.sort((a: any, b: any) => {
        const an = a.number ?? 0;
        const bn = b.number ?? 0;
        if (an !== bn) return an - bn;
        return (a.originalIndex ?? 0) - (b.originalIndex ?? 0);
      });
      arr.forEach((q: any, idx: number) => { q.displayNumber = idx + 1; });
    });

    // Debug log removed for production smoothness

    // Define type order and labels - include base types; clinical are shown separately below
    const typeOrder = ['mcq', 'qroc', 'open'];
    const getTypeLabel = (type: string) => {
      switch (type) {
        case 'mcq': return t('questions.mcq');
        case 'qroc': return 'QROC';
        case 'open': return t('questions.open');
        default: return type.toUpperCase();
      }
    };

    return (
      <div className="space-y-4">
        {/* Regular Questions */}
        {Object.keys(groupedQuestions).map(type => {
          const typeQuestions = groupedQuestions[type];
          if (!typeQuestions || typeQuestions.length === 0) return null;

          // Special rendering for QROC to separate grouped multi-QROC sets
          const isQroc = type === 'qroc';
          let singles = typeQuestions;
          let groups: any[] = [];
          if (isQroc) {
            groups = typeQuestions.filter(q => (q as any).meta?.multiQroc);
            singles = typeQuestions.filter(q => !(q as any).meta?.multiQroc);
          }

          const renderButton = (question: any, extraLabel?: string) => {
            // Consider grouped items answered when all children are answered
            const isGroup = Array.isArray((question as any).questions);
            const groupChildren: any[] = isGroup ? (question as any).questions : [];
            const isAnswered = isGroup
              ? groupChildren.every(q => answers[q.id] !== undefined)
              : answers[question.id] !== undefined;
            const isCurrent = question.originalIndex === currentQuestionIndex && !isComplete;
            const isCorrect = answerResults[question.id];
            
            // Determine the correct note ID to check
            let noteId = question.id;
            const groupMeta = (question as any).meta;
            if (groupMeta?.multiQroc) {
              // Multi QROC group uses group-qroc-{caseNumber}
              const caseNumber = question.number || question.id.replace('multiqroc-', '');
              noteId = `group-qroc-${caseNumber}`;
            } else if (groupMeta?.multiMcq) {
              // Multi MCQ group uses group-qcm-{caseNumber}
              const caseNumber = question.number || question.id.replace('multimcq-', '');
              noteId = `group-qcm-${caseNumber}`;
            }

            const hasNote = notesMap[noteId] === true;
            console.log('Task Navigator - Regular question notes check:', { questionId: question.id, noteId, hasNote, notesMap: notesMap[noteId] });
            const isHidden = (question as any).hidden === true;
            const isPinned = pinnedIds.includes(question.id) || (isGroup && groupChildren.some((q: any)=> pinnedIds.includes(q.id)));
            const isGroupHidden = isGroup && groupChildren.every((q:any)=> q.hidden);

            console.log('Task Navigator - Regular question notes check:', { questionId: question.id, noteId, hasNote, notesMap });
            return (
              <motion.div
                key={question.id}
                layout
                initial={{ opacity: 0.8, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0.8, y: -3 }}
                transition={{ 
                  type: 'spring', 
                  stiffness: 300, 
                  damping: 30, 
                  mass: 0.8,
                  opacity: { duration: 0.2 }
                }}
              >
                <Button
                  ref={(el) => { questionRefs.current[question.originalIndex] = el; }}
                  variant="outline"
                  className={cn(
                    "relative overflow-hidden w-full justify-start h-auto p-3 backdrop-blur-sm bg-white/90 dark:bg-gray-900/90 border border-gray-200/60 dark:border-gray-700/60 hover:bg-blue-50/70 dark:hover:bg-blue-900/30 hover:border-blue-300/80 dark:hover:border-blue-600/70 rounded-xl transition-colors duration-300 will-change-transform",
                    isCurrent && "border-blue-500 dark:border-blue-400 bg-blue-50/80 dark:bg-blue-900/40 shadow-[0_6px_18px_-4px_rgba(0,0,0,0.18)]",
                    isAnswered && !isCurrent && "bg-gray-50 dark:bg-gray-700/40"
                  )}
                  onClick={() => {
                    onQuestionSelect(question.originalIndex);
                    setIsDrawerOpen(false);
                  }}
                >
                  {/* Animated active glow */}
                  {isCurrent && (
                    <motion.div
                      layoutId="active-glow"
                      className="absolute inset-0 pointer-events-none"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 120, damping: 24, mass: 0.9 }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/15 via-blue-400/10 to-blue-500/15" />
                      <div className="absolute -inset-px rounded-xl ring-1 ring-blue-400/40 dark:ring-blue-500/30" />
                    </motion.div>
                  )}
                  <div className="flex items-start w-full relative">
                    <div className="flex flex-col items-start mr-3 flex-1 min-w-0">
                      {question.session && (
                        <span
                          className="text-left text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 truncate w-full"
                          title={question.session}
                        >
                          {question.session}
                        </span>
                      )}
                      <span className="text-left text-xs text-gray-600 dark:text-gray-400 truncate flex items-center gap-1 w-full">
                        {`${getTypeLabel(question.type)} ${(question as any).displayNumber ?? question.number ?? (question.originalIndex + 1)}`}
                        {extraLabel && (
                          <span className="text-[10px] uppercase tracking-wide text-blue-600 dark:text-blue-300 font-medium">{extraLabel}</span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isPinned && (
                        <Pin className="h-4 w-4 text-pink-600 dark:text-pink-400" />
                      )}
                      {/* Removed flag & pencil icons for grouped QROC entries */}
                      {hasNote && (
                        <StickyNote className="h-4 w-4 text-yellow-500" />
                      )}
                      {(isHidden || isGroupHidden) && (
                        <EyeOff className="h-4 w-4 text-red-500" />
                      )}
                      <motion.div
                        layout
                        className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700"
                        animate={isCurrent ? { 
                          opacity: 1, 
                          scale: 1.05,
                          boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.3)'
                        } : { 
                          opacity: 0.95, 
                          scale: 1,
                          boxShadow: '0 0 0 0px rgba(59, 130, 246, 0)'
                        }}
                        transition={{ 
                          type: 'spring', 
                          stiffness: 250, 
                          damping: 25,
                          boxShadow: { duration: 0.2 }
                        }}
                      >
                        {mode === 'revision' ? (
                          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                        ) : isAnswered ? (
                          isCorrect === true ? (
                            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                          ) : isCorrect === 'partial' ? (
                            <MinusCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                          )
                        ) : (
                          <Circle className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                        )}
                      </motion.div>
                    </div>
                  </div>
                </Button>
              </motion.div>
            );
          };

          return (
            <div key={type} className="space-y-3">
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50/50 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-700/50 rounded-xl">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                  {getTypeLabel(type)} ({typeQuestions.length})
                </span>
              </div>
              <div className="space-y-2">
                {/* Singles */}
                <AnimatePresence initial={false}>
                  {singles.map(q => renderButton(q))}
                </AnimatePresence>
                {/* Group divider */}
                {/* Separator removed per request */}
                {/* Groups */}
                {isQroc && (
                  <AnimatePresence initial={false}>
                    {groups.map(g => renderButton(g))}
                  </AnimatePresence>
                )}
              </div>
            </div>
          );
        })}

        {/* Clinical Cases */}
  {clinicalCases.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50/50 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-700/50 rounded-xl">
              <Stethoscope className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
    Cas Cliniques ({clinicalCases.length})
              </span>
            </div>
            <div className="space-y-2">
              {clinicalCases.map((clinicalCase) => {
                // Add null checks for questions array
                if (!clinicalCase.questions || !Array.isArray(clinicalCase.questions)) {
                  console.error('Invalid clinical case structure:', clinicalCase);
                  return null;
                }
                
                const isAnswered = clinicalCase.questions.every(q => answers[q.id] !== undefined);
                const isCurrent = clinicalCase.originalIndex === currentQuestionIndex && !isComplete;
                
                // Calculate overall result for the clinical case
                let isCorrect: boolean | 'partial' | undefined;
                if (isAnswered) {
                  const allCorrect = clinicalCase.questions.every(q => answerResults[q.id] === true);
                  const someCorrect = clinicalCase.questions.some(q => answerResults[q.id] === true || answerResults[q.id] === 'partial');
                  isCorrect = allCorrect ? true : (someCorrect ? 'partial' : false);
                }
                
                // Check for notes using clinical-case-{caseNumber} format
                const noteId = `clinical-case-${clinicalCase.caseNumber}`;
                const hasNote = notesMap[noteId] === true;

                console.log('Task Navigator - Clinical case notes check:', { caseNumber: clinicalCase.caseNumber, noteId, hasNote, notesMap: notesMap[noteId] });
                
                // Aggregate pin/hidden for clinical case
                const anyPinned = clinicalCase.questions.some(q => pinnedIds.includes(q.id));
                const allHidden = clinicalCase.questions.every(q => (q as any).hidden);
                // Derive session from first subquestion if present
                const firstSession = (clinicalCase.questions[0] as any)?.session as string | undefined;
                return (
                  <Button
                    key={`case-${clinicalCase.caseNumber}`}
                    ref={(el) => { questionRefs.current[clinicalCase.originalIndex] = el; }}
                    variant="outline"
                    className={cn(
                      "w-full justify-start h-auto p-3 backdrop-blur-sm bg-white/90 dark:bg-gray-900/90 border border-gray-200/60 dark:border-gray-700/60 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-300 dark:hover:border-blue-600 rounded-xl transition-all duration-200",
                      isCurrent && "border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/30 shadow-md",
                      isAnswered && "bg-gray-50 dark:bg-gray-700/50"
                    )}
                    onClick={() => {
                      onQuestionSelect(clinicalCase.originalIndex);
                      setIsDrawerOpen(false);
                    }}
                  >
                    <div className="flex items-center w-full relative">
                      <div className="flex flex-col items-start mr-3 flex-1 min-w-0">
                        {firstSession && (
                          <span
                            className="text-left text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 truncate w-full"
                            title={firstSession}
                          >
                            {firstSession}
                          </span>
                        )}
                        <span className="text-left text-xs text-gray-600 dark:text-gray-400 truncate w-full">
                          {`Cas ${clinicalCase.caseNumber}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {anyPinned && <Pin className="h-4 w-4 text-pink-600 dark:text-pink-400" />}
                        {/* Show StickyNote icon if the clinical case has notes */}
                        {hasNote && (
                          <StickyNote className="h-4 w-4 text-yellow-500" />
                        )}
                        {allHidden && <EyeOff className="h-4 w-4 text-red-500" />}
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700">
                        {mode === 'revision' ? (
                          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                        ) : isAnswered ? (
                          isCorrect === true ? (
                            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                          ) : isCorrect === 'partial' ? (
                            <MinusCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                          )
                        ) : (
                          <Circle className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                        )}
                        </div>
                      </div>
                    </div>
                  </Button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderNavigationButtons = () => (
    <div className="flex justify-between gap-3 mt-6 pt-4 border-t border-gray-200/60 dark:border-gray-700/60">
      <Button
        variant="outline"
        onClick={() => {
          onPrevious();
          setIsDrawerOpen(false);
        }}
        disabled={currentQuestionIndex === 0 || isComplete}
        className="flex-1 backdrop-blur-sm bg-white/90 dark:bg-gray-900/90 border border-gray-200/60 dark:border-gray-700/60 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-xl"
      >
        <ChevronLeft className="h-4 w-4 mr-2" />
        {t('common.previous')}
      </Button>
      {isComplete ? (
        <Button
          variant="outline"
          onClick={() => {
            // This should trigger the completion view
            onNext();
            setIsDrawerOpen(false);
          }}
          className="flex-1 backdrop-blur-sm bg-white/90 dark:bg-gray-900/90 border border-gray-200/60 dark:border-gray-700/60 hover:bg-blue-50 dark:hover:bg-blue-900/50 hover:border-blue-300 dark:hover:border-blue-600 rounded-xl"
        >
          {t('questions.viewSummary')}
        </Button>
      ) : (
        <Button
          onClick={() => {
            onNext();
            setIsDrawerOpen(false);
          }}
          className="flex-1 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 rounded-xl"
        >
          {t('common.next')}
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      )}
    </div>
  );

  return (
    <>
      <MobileDrawer />
      <DesktopPanel />
    </>
  );
}
