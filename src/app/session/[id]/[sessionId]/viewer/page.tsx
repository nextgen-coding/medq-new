'use client'

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  FileText,
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Minimize2,
  FileCheck2,
  PanelRightOpen,
  PanelRightClose,
  CheckCircle,
  Link,
  Link2Off,
  Trash2,
  Copy
} from 'lucide-react';
// Lazy client-only react-pdf imports to avoid SSR DOMMatrix errors
import dynamic from 'next/dynamic';
const PDFDoc = dynamic(() => import('react-pdf').then(m => m.Document), { ssr: false });
const PDFPage = dynamic(() => import('react-pdf').then(m => m.Page), { ssr: false });
import { useAuth } from '@/contexts/AuthContext';
import { PDFProvider } from '@/components/pdf/PDFProvider';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { UniversalHeader } from '@/components/layout/UniversalHeader';
import { AppSidebar, AppSidebarProvider } from '@/components/layout/AppSidebar';
import { SidebarInset, useSidebar } from '@/components/ui/sidebar';
import { CorrectionZone } from '@/components/session/CorrectionZone';
import { getCorrection } from '@/app/actions/correction';

// Import CSS for react-pdf
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker
import { pdfjs } from 'react-pdf';

// Set up the worker to use the local public/pdf.worker.mjs file
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';
}

type Session = {
  id: string;
  name: string;
  pdfUrl?: string;
  correctionUrl?: string;
  specialty: {
    id: string;
    name: string;
  };
  niveau?: {
    name: string;
  };
  semester?: {
    name: string;
    order: number;
  };
};

// Helper to sanitize / normalize PDF links (Google Drive share -> direct download)
function getValidPdfLink(dbLink?: string | null): string | undefined {
  if (!dbLink) return undefined;
  // Already looks like a direct PDF
  if (/\.pdf($|[?#])/i.test(dbLink)) return dbLink;
  // Google Drive patterns
  const driveRegex = /https?:\/\/drive\.google\.com\/(?:file\/d\/|open\?id=)([a-zA-Z0-9_-]+)/i;
  const match = dbLink.match(driveRegex);
  if (match) {
    const id = match[1];
  return `https://drive.google.com/uc?export=download&id=${id}`; // will be proxied client-side
  }
  // If already a uc?export form keep it
  if (/https?:\/\/drive\.google\.com\/uc\?export=download&id=/i.test(dbLink)) return dbLink;
  return dbLink; // fallback unchanged
}

// Removed floating correction button / modal; correction now displayed inline beside exam.

export default function SessionViewerPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(true);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [scale, setScale] = useState(1.33);
  // Exam PDF state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Removed page/scroll toggle: always scrolling all pages
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [showCorrectionPdf, setShowCorrectionPdf] = useState(false); // replaces zone when true
  const [correctionModeEnabled, setCorrectionModeEnabled] = useState(false); // new toggle for correction zone vs PDF

  // Correction PDF state (separate page/zoom/rotation)
  const [correctionNumPages, setCorrectionNumPages] = useState<number | null>(null);
  const [correctionScale, setCorrectionScale] = useState(1.33);
  const [correctionRotation, setCorrectionRotation] = useState(0);
  const [correctionLoading, setCorrectionLoading] = useState(true);
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  
  // PDF Linking Feature State
  const [isLinkingMode, setIsLinkingMode] = useState(false);
  const [pdfLinks, setPdfLinks] = useState<Array<{
    id: string;
    page: number;
    x: number;
    y: number;
    title: string;
    timestamp: number;
  }>>([]);
  const [selectedLink, setSelectedLink] = useState<string | null>(null);
  const [pendingQuestionLink, setPendingQuestionLink] = useState<{
    questionId: string;
    questionNumber?: number;
  } | null>(null);
  
  // User mode state - controlled by CorrectionZone
  const [isUserMode, setIsUserMode] = useState(false);
  
  // Refs for auto-fit sizing
  const examViewerRef = useRef<HTMLDivElement | null>(null);
  const correctionViewerRef = useRef<HTMLDivElement | null>(null);
  // Store last scroll position for correction PDF
  const correctionScrollPos = useRef<number>(0);

  // Save scroll position when hiding correction PDF
  const prevShowCorrectionPdf = useRef(showCorrectionPdf);
  useEffect(() => {
    const ref = correctionViewerRef.current;
    if (prevShowCorrectionPdf.current && !showCorrectionPdf && ref) {
      correctionScrollPos.current = ref.scrollTop;
    }
    prevShowCorrectionPdf.current = showCorrectionPdf;
  }, [showCorrectionPdf]);

  // Restore scroll position only after PDF is loaded and visible
  useEffect(() => {
    if (!showCorrectionPdf || correctionLoading) return;
    const ref = correctionViewerRef.current;
    if (ref) {
      ref.scrollTop = correctionScrollPos.current;
      setTimeout(() => {
        if (ref) ref.scrollTop = correctionScrollPos.current;
      }, 400);
    }
  }, [showCorrectionPdf, correctionLoading]);
  const fitExamPage = useCallback(() => {
    // Disabled: always maintain 133% zoom
    setScale(1.33);
  }, []);

  const fitCorrectionPage = useCallback(() => {
    // Disabled: always maintain 133% zoom  
    setCorrectionScale(1.33);
  }, []);

  const viewType = searchParams.get('type') || 'exam';
  const mode: 'admin' | 'maintainer' | 'student' = user?.role === 'admin' ? 'admin' : user?.role === 'maintainer' ? 'maintainer' : 'student';
  const isAdminOrMaintainer = mode === 'admin' || mode === 'maintainer';
  const [hasDbCorrection, setHasDbCorrection] = useState<boolean | null>(null);

  // Normalize params
  const sessionId = Array.isArray(params.sessionId) ? params.sessionId[0] : params.sessionId;
  const specialtyId = Array.isArray(params.id) ? params.id[0] : params.id;
  
  // Sanitize exam and correction URLs independently
  const examUrlRaw = session?.pdfUrl ? getValidPdfLink(session.pdfUrl) : undefined;
  const correctionUrlRaw = session?.correctionUrl ? getValidPdfLink(session.correctionUrl) : undefined;
  const examUrl = examUrlRaw ? (/drive\.google\.com/.test(examUrlRaw) ? `/api/proxy-pdf?url=${encodeURIComponent(examUrlRaw)}` : examUrlRaw) : undefined;
  const correctionUrl = correctionUrlRaw ? (/drive\.google\.com/.test(correctionUrlRaw) ? `/api/proxy-pdf?url=${encodeURIComponent(correctionUrlRaw)}` : correctionUrlRaw) : undefined;
  const currentPdfUrl = examUrl; // always exam in main view
  // Capabilities: Zone is available to admins at all times, and to students only if a DB correction exists. PDF depends on URL.
  const canShowCorrectionPdf = !!(session && correctionUrlRaw);
  const canShowCorrectionZone = !!session && (isAdminOrMaintainer || hasDbCorrection === true);
  const canShowCorrectionButton = isAdminOrMaintainer && (canShowCorrectionPdf || canShowCorrectionZone);
  // auto open PDF view (in-panel) if ?type=correction
  useEffect(() => { if (viewType === 'correction' && canShowCorrectionPdf) { setPanelCollapsed(false); setShowCorrectionPdf(true); } }, [viewType, canShowCorrectionPdf]);

  // Fetch whether a DB correction exists for this session (for student visibility gating)
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        if (!sessionId) return;
        // Server action call – will respect current user's auth
        const res = await getCorrection(String(sessionId));
        if (!cancelled) {
          setHasDbCorrection(!!(res && (res as any).success && (res as any).correction));
        }
      } catch (e) {
        if (!cancelled) setHasDbCorrection(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [sessionId]);

  // Fetch session data
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!sessionId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/sessions/${sessionId}`, { cache: 'no-store' });
        if (!res.ok) {
          if (res.status === 404) {
            if (!cancelled) {
              setSession(null);
              setError('Session introuvable');
            }
          } else {
            const txt = await res.text().catch(() => '');
            console.warn('Fetch session error', res.status, txt);
            if (!cancelled) setError('Erreur lors du chargement de la session');
          }
        } else {
          const data = await res.json();
          if (!cancelled) {
            setSession(data);
          }
        }
      } catch (e) {
        console.error('Network error session fetch', e);
        if (!cancelled) setError('Erreur réseau');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [sessionId, viewType]);

  // PDF handlers
  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoadingPdf(false);
    setPdfError(null);
  }, []);

  const onDocumentLoadError = useCallback((err: Error) => {
    console.error('PDF load error', err);
    setLoadingPdf(false);
    // Normalize common pdf.js error types
    if ((err as any)?.name === 'MissingPDFException') {
      setPdfError('Document PDF introuvable.');
    } else if ((err as any)?.name === 'InvalidPDFException') {
      setPdfError('Fichier PDF invalide ou corrompu.');
    } else if ((err as any)?.name === 'UnexpectedResponseException') {
      setPdfError('Réponse inattendue lors du chargement du PDF.');
    } else {
      setPdfError('Erreur lors du chargement du PDF.');
    }
  }, []);

  const changeScale = (delta: number) => {
    setScale(prev => Math.max(0.5, Math.min(prev + delta, 3)));
  };

  // PDF Linking Functions
  const handlePdfClick = useCallback((event: React.MouseEvent, pageNumber: number) => {
    if (!isLinkingMode) return;
    
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100; // percentage
    const y = ((event.clientY - rect.top) / rect.height) * 100; // percentage
    
    const linkId = `link_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Use pending question info for better title, or fallback to generic
    const linkTitle = pendingQuestionLink 
      ? `Question ${pendingQuestionLink.questionNumber || pendingQuestionLink.questionId}`
      : `Question ${pageNumber}-${pdfLinks.length + 1}`;
    
    const newLink = {
      id: linkId,
      page: pageNumber,
      x: x,
      y: y,
      title: linkTitle,
      timestamp: Date.now()
    };
    
    setPdfLinks(prev => [...prev, newLink]);
    setSelectedLink(linkId);
    setIsLinkingMode(false);
    setPendingQuestionLink(null); // Clear pending question
    
    // Copy link to clipboard
    const linkUrl = `${window.location.origin}${window.location.pathname}?link=${linkId}`;
    navigator.clipboard.writeText(linkUrl).then(() => {
      console.log(`✅ Lien créé et copié: ${linkTitle}`, linkUrl);
    });
  }, [isLinkingMode, pdfLinks.length, pendingQuestionLink]);

  const scrollToLink = useCallback((linkId: string) => {
    const link = pdfLinks.find(l => l.id === linkId);
    if (!link || !examViewerRef.current) return;
    
    // Find the page element
    const pageElements = examViewerRef.current.querySelectorAll('[data-page-number]');
    const targetPage = Array.from(pageElements).find(el => 
      el.getAttribute('data-page-number') === link.page.toString()
    );
    
    if (targetPage) {
      const rect = targetPage.getBoundingClientRect();
      const containerRect = examViewerRef.current.getBoundingClientRect();
      
      // Calculate scroll position
      const scrollTop = examViewerRef.current.scrollTop + rect.top - containerRect.top;
      const linkY = (link.y / 100) * rect.height;
      
      examViewerRef.current.scrollTo({
        top: scrollTop + linkY - 100, // offset for better visibility
        behavior: 'smooth'
      });
      
      setSelectedLink(linkId);
    }
  }, [pdfLinks]);

  // Check for link parameter on load
  useEffect(() => {
    const linkParam = searchParams.get('link');
    if (linkParam && pdfLinks.some(l => l.id === linkParam)) {
      setTimeout(() => scrollToLink(linkParam), 1000); // wait for PDF to load
    }
  }, [searchParams, pdfLinks, scrollToLink]);

  const toggleLinkingMode = () => {
    setIsLinkingMode(!isLinkingMode);
    setSelectedLink(null);
    setPendingQuestionLink(null); // Clear any pending question
  };

  const removeLink = (linkId: string) => {
    setPdfLinks(prev => prev.filter(l => l.id !== linkId));
    if (selectedLink === linkId) {
      setSelectedLink(null);
    }
  };

  // Handle question linking from CorrectionZone
  const handleQuestionLink = useCallback((questionId: string, questionNumber?: number) => {
    // First, focus the PDF viewer by making sure correction PDF is not shown
    setShowCorrectionPdf(false);
    setPanelCollapsed(false); // Show correction panel but not PDF mode
    
    // Create or navigate to existing link for this question
    const questionTitle = `Question ${questionNumber || questionId}`;
    const existingLink = pdfLinks.find(link => 
      link.title.includes(questionTitle) || 
      link.title.includes(`Question ${questionNumber}`) ||
      link.id.includes(questionId)
    );
    
    if (existingLink) {
      // If link exists, navigate to it
      scrollToLink(existingLink.id);
      console.log(`✅ Navigation vers la ${questionTitle} dans le PDF`);
    } else {
      // If no link exists, activate linking mode and set pending question info
      setIsLinkingMode(true);
      setSelectedLink(null);
      setPendingQuestionLink({ questionId, questionNumber });
      
      // Don't automatically scroll - keep current position for better UX
      console.log(`🔗 Mode lien activé pour la ${questionTitle}. Cliquez sur la question dans le PDF pour créer le lien.`);
    }
  }, [pdfLinks, scrollToLink]);

  // Handle user mode changes from CorrectionZone
  const handleUserModeChange = useCallback((userMode: boolean) => {
    setIsUserMode(userMode);
    // Exit linking mode if entering user mode
    if (userMode && isLinkingMode) {
      setIsLinkingMode(false);
      setPendingQuestionLink(null);
    }
    
    // Reset scroll position when switching to user mode to prevent overflow issues
    if (userMode) {
      setTimeout(() => {
        const correctionContainer = document.querySelector('.correction-zone-scroll');
        if (correctionContainer) {
          correctionContainer.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }, 100);
    }
  }, [isLinkingMode]);

  const toggleFullscreen = () => {
    try {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.();
        setIsFullscreen(true);
      } else {
        document.exitFullscreen?.();
        setIsFullscreen(false);
      }
    } catch (e) {
      console.error('Fullscreen error', e);
    }
  };

  // Pre-validate PDF via HEAD (or GET fallback) when URL changes to surface errors early.
  useEffect(() => {
    if (!currentPdfUrl) return;
    let cancelled = false;
    setPdfError(null);
    setLoadingPdf(true);
    const controller = new AbortController();
    const validate = async () => {
      try {
        // Skip preflight for proxied (local) URL; proxy enforces type
        if (!currentPdfUrl.startsWith('/api/proxy-pdf')) {
          let res = await fetch(currentPdfUrl, { method: 'HEAD', signal: controller.signal });
          if (!res.ok) {
            if (!cancelled) setPdfError(`Impossible de charger le PDF (HTTP ${res.status}).`);
            return;
          }
          const ct = res.headers.get('content-type') || '';
          if (!ct.includes('pdf')) {
            if (!cancelled) setPdfError('Le lien ne pointe pas vers un PDF.');
            return;
          }
        }
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        console.error('PDF HEAD validation error', e);
        if (!cancelled) setPdfError('Erreur réseau lors de la vérification du PDF.');
      }
    };
    validate();
    return () => { cancelled = true; controller.abort(); };
  }, [currentPdfUrl]);

  // Auto-fit disabled to maintain 133% zoom
  // useEffect(() => {
  //   const handle = () => { fitExamPage(); fitCorrectionPage(); };
  //   window.addEventListener('resize', handle);
  //   return () => window.removeEventListener('resize', handle);
  // }, [fitExamPage, fitCorrectionPage]);

  // Auto-fit disabled to maintain 133% zoom
  // useEffect(() => { fitExamPage(); }, [numPages, panelCollapsed, rotation, fitExamPage]);
  // useEffect(() => { if (showCorrectionPdf) fitCorrectionPage(); }, [showCorrectionPdf, correctionNumPages, correctionRotation, panelCollapsed, fitCorrectionPage]);

  // Prevent any scrolling beyond viewport
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevHeight = document.body.style.height;
    const prevHTMLOverflow = document.documentElement.style.overflow;
    const prevHTMLHeight = document.documentElement.style.height;
    
    document.body.style.overflow = 'hidden';
    document.body.style.height = '100vh';
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.height = '100vh';
    
    return () => { 
      document.body.style.overflow = prevOverflow; 
      document.body.style.height = prevHeight;
      document.documentElement.style.overflow = prevHTMLOverflow;
      document.documentElement.style.height = prevHTMLHeight;
    };
  }, []);

  // Keyboard shortcut: C toggles Correction PDF panel (open to PDF, press again closes)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Only plain 'c' (case-insensitive), no Ctrl/Meta; Shift allowed
      const key = e.key?.toLowerCase();
      if (key !== 'c' || e.ctrlKey || e.metaKey || e.altKey) return;

      // Avoid when typing in inputs/textareas/contenteditable
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        const isEditable = (target as any).isContentEditable;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || isEditable) return;
      }

      // Must have a correction PDF available
      if (!canShowCorrectionPdf || !correctionUrl) return;

  e.preventDefault();

      // If panel collapsed, open directly to PDF
      if (panelCollapsed) {
        setPanelCollapsed(false);
        // If correction mode is enabled (zone/pdf toggle), force PDF view
        if (correctionModeEnabled) setShowCorrectionPdf(true);
        return;
      }

      // Panel is open: if currently showing PDF, close; otherwise switch to PDF
      const currentlyShowingPdf = (!correctionModeEnabled) || (correctionModeEnabled && showCorrectionPdf);
      if (currentlyShowingPdf) {
        setPanelCollapsed(true);
      } else {
        setShowCorrectionPdf(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [panelCollapsed, correctionModeEnabled, showCorrectionPdf, canShowCorrectionPdf, correctionUrl]);

  return (
    <ProtectedRoute>
      <AppSidebarProvider>
        <SidebarOpenConsumer>
          {(sidebarOpen) => (
            <PDFProvider>
              <div className="flex h-screen w-full overflow-hidden">
            <AppSidebar />
            <SidebarInset className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900 h-screen max-h-screen overflow-hidden">
              {/* Custom header removed. Add Retour, session name, and correction toggle to PDF controls below. */}
              <div className="flex-1 flex flex-col h-full max-h-full overflow-hidden">
                <div className="flex-1 overflow-auto p-2 sm:p-3 lg:p-4 h-full max-h-full scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                  {loading ? (
                  <div className="flex items-center justify-center min-h-[50vh]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : !session ? (
                  <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
                    <FileText className="h-12 w-12 text-muted-foreground" />
                    <h2 className="text-xl font-semibold">{error || 'Session non trouvée'}</h2>
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => router.push(specialtyId ? `/session/${specialtyId}` : '/session')} 
                        size="default"
                        className="group gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all duration-200"
                      >
                        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform duration-200" /> 
                        <span className="font-medium">Retour</span>
                      </Button>
                      {sessionId && (
                        <Button variant="outline" size="default" onClick={() => router.refresh()} className="bg-card/80 border-border hover:bg-accent hover:border-accent-foreground/20 transition-all duration-200">
                          Réessayer
                        </Button>
                      )}
                    </div>
                  </div>
                ) : !currentPdfUrl ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2">Document non disponible</h3>
                      <p className="text-muted-foreground text-center mb-4">
                        {"Le document de cet examen n'est pas disponible."}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="w-full mx-auto max-w-[1600px] grid gap-3 xl:grid-cols-12 items-start h-full max-h-full overflow-hidden"
                    style={{height: '95vh', maxHeight: '95vh', overflow: 'hidden'}}>
                    {/* Exam PDF Viewer (responsive to sidebar) */}
                    <div
                      className={`min-w-0 space-y-2 transition-all duration-300 overflow-hidden
                        ${!panelCollapsed ? (showCorrectionPdf ? 'xl:col-span-7 2xl:col-span-7' : 'xl:col-span-8 2xl:col-span-8') : 'xl:col-span-12'}
                        ${showCorrectionPdf && !panelCollapsed ? 'xl:col-span-7 2xl:col-span-7' : ''}
                      `}
                    >
                      <Card className="border-border/50 bg-white/50 dark:bg-muted/30 backdrop-blur-sm shadow-lg">
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-blue-400/40 via-blue-600/10 to-blue-400/40" />
                        <CardContent className="p-3 sm:p-4">
                          <div className="flex items-center gap-2 flex-wrap text-xs sm:text-sm">
                            {/* Left group: Retour, session name, label, pages */}
                            <div className="flex items-center gap-2">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => router.push(specialtyId ? `/session/${specialtyId}` : '/session')} 
                                className="group gap-2 hover:bg-accent/50 transition-all duration-200 text-foreground/70 hover:text-foreground"
                              >
                                <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform duration-200" />
                                <span className="font-medium">Retour</span>
                              </Button>
                              {session && (
                                <span className="font-semibold text-blue-900 dark:text-blue-100 text-base mr-2">{session.name}</span>
                              )}
                              <Badge variant="default" className="bg-blue-600 text-white text-xs">Examen</Badge>
                              {numPages && (
                                <span className="text-sm text-blue-800 dark:text-blue-200 font-medium whitespace-nowrap">{numPages} pages</span>
                              )}
                            </div>
                            {/* Center group: zoom/adjust/rotate/fullscreen/link */}
                            <div className="flex-1 flex items-center justify-center gap-2 min-w-[200px]">
                              <Button variant="outline" size="sm" onClick={() => changeScale(-0.2)} disabled={scale <= 0.5}
                                className="bg-white/70 dark:bg-muted/40 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-800 p-2">
                                <ZoomOut className="h-4 w-4" />
                              </Button>
                              <span className="text-xs text-blue-800 dark:text-blue-200 font-medium min-w-[50px] text-center">{Math.round(scale * 100)}%</span>
                              <Button variant="outline" size="sm" onClick={() => changeScale(0.2)} disabled={scale >= 3}
                                className="bg-white/70 dark:bg-muted/40 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-800 p-2">
                                <ZoomIn className="h-4 w-4" />
                              </Button>
                              <Button variant="outline" size="sm" onClick={fitExamPage}
                                className="bg-white/70 dark:bg-muted/40 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-800 px-2 text-[11px]">Ajuster</Button>
                              <Button variant="outline" size="sm" onClick={() => setRotation(prev => (prev + 90) % 360)}
                                className="bg-white/70 dark:bg-muted/40 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-800 p-2">
                                <RotateCw className="h-4 w-4" />
                              </Button>
                              <Button variant="outline" size="sm" onClick={toggleFullscreen}
                                className="hidden sm:flex bg-white/70 dark:bg-muted/40 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-800 p-2">
                                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                              </Button>
                              {/* Hide linking mode button in user mode or when correction mode is disabled */}
                              {!isUserMode && correctionModeEnabled && (
                                <Button 
                                  variant={isLinkingMode ? "default" : "outline"} 
                                  size="sm" 
                                  onClick={toggleLinkingMode}
                                  className={`${isLinkingMode 
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600' 
                                    : 'bg-white/70 dark:bg-muted/40 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-800'
                                  } p-2 transition-all duration-200`}
                                  title={isLinkingMode ? "Désactiver le mode lien" : "Activer le mode lien"}
                                >
                                  {isLinkingMode ? <Link2Off className="h-4 w-4" /> : <Link className="h-4 w-4" />}
                                </Button>
                              )}
                            </div>
                            {/* Right group: admin correction toggle and show/hide correction panel */}
                            <div className="ml-auto flex items-center gap-2">
                              {canShowCorrectionButton && (
                                <Button
                                  variant={correctionModeEnabled ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => {
                                    const newCorrectionMode = !correctionModeEnabled;
                                    setCorrectionModeEnabled(newCorrectionMode);
                                    if (newCorrectionMode) {
                                      setPanelCollapsed(false);
                                      setShowCorrectionPdf(!canShowCorrectionZone && canShowCorrectionPdf);
                                    } else {
                                      setIsLinkingMode(false);
                                    }
                                  }}
                                  className={`gap-1 sm:gap-2 transition-all duration-200 h-8 px-2 sm:px-3 text-xs sm:text-sm ${
                                    correctionModeEnabled 
                                      ? 'bg-green-600 hover:bg-green-700 text-white border-green-600' 
                                      : 'border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                                  }`}
                                >
                                  <FileCheck2 className="h-3 w-3 sm:h-4 sm:w-4" />
                                  <span className="font-medium hidden sm:inline">Correction {correctionModeEnabled ? 'ON' : 'OFF'}</span>
                                  <span className="font-medium sm:hidden">{correctionModeEnabled ? 'ON' : 'OFF'}</span>
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setPanelCollapsed(c => !c);
                                  if (panelCollapsed) {
                                    if (correctionModeEnabled) {
                                      setShowCorrectionPdf(false);
                                    } else {
                                      setShowCorrectionPdf(true);
                                    }
                                  }
                                }}
                                disabled={!canShowCorrectionButton}
                                className="bg-white/70 dark:bg-muted/40 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-800 gap-1"
                                title={canShowCorrectionPdf ? "Afficher/Masquer la correction (C)" : "Afficher/Masquer la correction"}
                              >
                                {panelCollapsed ? <PanelRightOpen className="h-4 w-4" /> : <PanelRightClose className="h-4 w-4" />}
                                <span className="hidden sm:inline">
                                  {panelCollapsed ? 'Afficher correction' : 'Masquer correction'}
                                </span>
                                {canShowCorrectionPdf && (
                                  <span className="hidden lg:inline text-[10px] text-muted-foreground ml-1">C</span>
                                )}
                              </Button>
                            </div>
                            {/* Linking Mode Helper Text - only show when correction mode is enabled */}
                            {isLinkingMode && correctionModeEnabled && (
                              <div className="mt-2 p-2 bg-blue-50/80 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
                                <p className="text-xs text-blue-700 dark:text-blue-300 text-center">
                                  {pendingQuestionLink 
                                    ? `🎯 Cliquez sur la Question ${pendingQuestionLink.questionNumber || pendingQuestionLink.questionId} dans le PDF`
                                    : `📍 Cliquez sur une section du PDF pour créer un lien`
                                  }
                                </p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                      
                      {/* PDF Links Management Panel (hidden in user mode or when correction mode is disabled) */}
                      {!isUserMode && correctionModeEnabled && pdfLinks.length > 0 && (
                        <Card className="border-border/50 bg-white/50 dark:bg-muted/30 backdrop-blur-sm shadow-lg">
                          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-blue-400/40 via-blue-600/10 to-blue-400/40" />
                          <CardContent className="p-3 sm:p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <Link className="h-4 w-4 text-blue-600" />
                              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">Liens créés ({pdfLinks.length})</span>
                            </div>
                            <div className="space-y-2 max-h-32 overflow-y-auto">
                              {pdfLinks.map((link) => (
                                <div key={link.id} className="flex items-center justify-between p-2 bg-blue-50/50 dark:bg-blue-900/20 rounded-lg">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">Page {link.page}</span>
                                    <span className="text-xs text-gray-600 dark:text-gray-400 truncate">{link.title}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => scrollToLink(link.id)}
                                      className="h-6 w-6 p-0 hover:bg-blue-100 dark:hover:bg-blue-800"
                                      title="Aller au lien"
                                    >
                                      <Link className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        const linkUrl = `${window.location.origin}${window.location.pathname}?link=${link.id}`;
                                        navigator.clipboard.writeText(linkUrl);
                                      }}
                                      className="h-6 w-6 p-0 hover:bg-blue-100 dark:hover:bg-blue-800"
                                      title="Copier le lien"
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                    {!isUserMode && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeLink(link.id)}
                                        className="h-6 w-6 p-0 hover:bg-red-100 dark:hover:bg-red-800 text-red-600"
                                        title="Supprimer le lien"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                        </CardContent>
                      </Card>
                      )}

                      {/* Exam PDF content */}
                      <Card
                        className="border-border/50 bg-white/50 dark:bg-muted/30 backdrop-blur-sm shadow-lg overflow-hidden h-[100dvh] sm:h-[100vh]"
                        style={{ maxHeight: '100vh', overflow: 'hidden' }}>
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-blue-400/40 via-blue-600/10 to-blue-400/40" />
                        <CardContent className="p-0 h-full flex flex-col" style={{height: '100%'}}>
                          <div className="flex justify-center bg-gradient-to-br from-blue-50/80 via-white to-indigo-50/40 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 relative rounded-md flex-1 overflow-visible" style={{ height: '100%' }}>
                            {pdfError ? (
                              <div className="flex flex-col items-center justify-center text-center p-8 gap-3 max-w-md">
                                <div className="w-16 h-16 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-2">
                                  <FileText className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                                </div>
                                <p className="font-medium text-blue-800 dark:text-blue-200">{pdfError}</p>
                                <div className="flex gap-2">
                                  <Button size="sm" onClick={() => setRotation(r => (r + 90) % 360)} variant="outline"
                                    className="bg-white/70 dark:bg-muted/40 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-800">
                                    Tourner
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => window.open(currentPdfUrl!, '_blank')}
                                    className="bg-white/70 dark:bg-muted/40 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-800">
                                    Ouvrir dans un onglet
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {loadingPdf && (
                                  <div className="absolute inset-0 flex items-center justify-center backdrop-blur-sm bg-white/20 dark:bg-slate-900/20">
                                    <div className="flex items-center gap-3 bg-white/80 dark:bg-slate-800/80 px-4 py-3 rounded-xl shadow-lg">
                                      <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                                      <span className="text-blue-800 dark:text-blue-200 font-medium">Chargement du PDF...</span>
                                    </div>
                                  </div>
                                )}
                                <div ref={examViewerRef} className="w-full h-full overflow-y-auto overflow-x-auto px-4 py-4 exam-scroll"> 
                                  <PDFDoc
                                    file={currentPdfUrl}
                                    onLoadSuccess={onDocumentLoadSuccess}
                                    onLoadError={onDocumentLoadError}
                                    loading=""
                                    className="w-fit min-w-full"
                                  >
                                    {numPages ? (
                                      <div className="w-fit min-w-full flex flex-col items-center gap-8">
                                        {Array.from({ length: numPages }, (_, i) => (
                                          <div
                                            key={i}
                                            className={`relative ${correctionModeEnabled && isLinkingMode ? 'cursor-crosshair' : 'cursor-default'}`}
                                            onClick={correctionModeEnabled ? (e) => handlePdfClick(e, i + 1) : undefined}
                                            data-page-number={i + 1}
                                          >
                                            <PDFPage
                                              pageNumber={i + 1}
                                              scale={scale}
                                              rotate={rotation}
                                              className="shadow-xl bg-white rounded-lg border-2 border-blue-100 dark:border-blue-800"
                                              renderTextLayer={false}
                                              renderAnnotationLayer={false}
                                            />
                                            {correctionModeEnabled && pdfLinks
                                              .filter(link => link.page === i + 1)
                                              .map(link => (
                                                <div
                                                  key={link.id}
                                                  className={`absolute w-6 h-6 rounded-full border-2 cursor-pointer transition-all duration-200 ${
                                                    selectedLink === link.id
                                                      ? 'bg-red-500 border-red-600 scale-125'
                                                      : 'bg-blue-500 border-blue-600 hover:scale-110'
                                                  }`}
                                                  style={{
                                                    left: `${link.x}%`,
                                                    top: `${link.y}%`,
                                                    transform: 'translate(-50%, -50%)'
                                                  }}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    scrollToLink(link.id);
                                                  }}
                                                  title={link.title}
                                                >
                                                  <div className="w-full h-full rounded-full bg-white/20 flex items-center justify-center">
                                                    <Link className="w-3 h-3 text-white" />
                                                  </div>
                                                </div>
                                              ))
                                            }
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="w-fit min-w-full h-full flex justify-center items-center">
                                        <div 
                                          className={`relative ${correctionModeEnabled && isLinkingMode ? 'cursor-crosshair' : 'cursor-default'}`}
                                          onClick={correctionModeEnabled ? (e) => handlePdfClick(e, 1) : undefined}
                                          data-page-number={1}
                                        >
                                          <PDFPage
                                            pageNumber={1}
                                            scale={scale}
                                            rotate={rotation}
                                            className="shadow-xl bg-white rounded-lg border-2 border-blue-100 dark:border-blue-800"
                                            renderTextLayer={false}
                                            renderAnnotationLayer={false}
                                          />
                                          {/* Render link indicators for single page only when correction mode is enabled */}
                                          {correctionModeEnabled && pdfLinks
                                            .filter(link => link.page === 1)
                                            .map(link => (
                                              <div
                                                key={link.id}
                                                className={`absolute w-6 h-6 rounded-full border-2 cursor-pointer transition-all duration-200 ${
                                                  selectedLink === link.id
                                                    ? 'bg-red-500 border-red-600 scale-125'
                                                    : 'bg-blue-500 border-blue-600 hover:scale-110'
                                                }`}
                                                style={{
                                                  left: `${link.x}%`,
                                                  top: `${link.y}%`,
                                                  transform: 'translate(-50%, -50%)'
                                                }}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  scrollToLink(link.id);
                                                }}
                                                title={link.title}
                                              >
                                                <div className="w-full h-full rounded-full bg-white/20 flex items-center justify-center">
                                                  <Link className="w-3 h-3 text-white" />
                                                </div>
                                              </div>
                                            ))
                                          }
                                        </div>
                                      </div>
                                    )}
                                  </PDFDoc>
                                </div>
                              </>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                    {/* Correction Panel - always available when session exists and panel not collapsed */}
                    {session && !panelCollapsed && (
                      <div
                        className={`min-w-0 transition-all duration-300 flex flex-col min-h-0
                          ${showCorrectionPdf ? 'xl:col-span-5 2xl:col-span-5' : 'xl:col-span-4 2xl:col-span-4'}
                          h-[100dvh] sm:h-[100vh]`}
                        style={{ height: undefined, maxHeight: undefined }}
                      >
                        <Card
                          className="border-border/50 bg-white/50 dark:bg-muted/30 backdrop-blur-sm shadow-lg flex flex-col min-h-0 h-[100dvh] sm:h-[100vh]"
                          style={{ maxHeight: '100vh' }}>
                          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-blue-400/40 via-blue-600/10 to-blue-400/40" />
                          <CardContent className="p-3 sm:p-4 flex flex-col h-full min-h-0">
                            <div className="hidden sm:flex items-center gap-2 mb-3 flex-shrink-0">
                              <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                                {correctionModeEnabled ? "Zone de Correction" : "PDF de Correction"}
                              </span>
                              {/* Toggle between PDF and Zone when correction mode is enabled */}
                              {canShowCorrectionPdf && canShowCorrectionZone && correctionModeEnabled && (
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  onClick={() => setShowCorrectionPdf(!showCorrectionPdf)} 
                                  className="ml-auto gap-2 bg-white/70 dark:bg-muted/40 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-800"
                                >
                                  {showCorrectionPdf ? "Voir Zone de Correction" : "Voir PDF"}
                                </Button>
                              )}
                              {/* Close panel button - always available */}
                              {!correctionModeEnabled && (
                                <Button size="sm" variant="outline" onClick={() => setPanelCollapsed(true)} className="ml-auto gap-2 bg-white/70 dark:bg-muted/40 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-800">
                                  Fermer
                                </Button>
                              )}
                            </div>
                            {/* Mobile-only: Always show PDF in the panel, Zone opens via floating button */}
                            {canShowCorrectionPdf && correctionUrl && (
                              <div className="flex sm:hidden flex-col border border-blue-100 dark:border-blue-800 rounded-lg overflow-hidden bg-gradient-to-br from-blue-50/60 via-white to-indigo-50/40 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex-1 min-h-0">
                                {/* Mobile PDF Header */}
                                <div className="flex items-center justify-between px-3 py-2 border-b border-blue-200 dark:border-blue-800 bg-white/80 dark:bg-muted/40 flex-shrink-0">
                                  <div className="flex items-center gap-2">
                                    <CheckCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                    <span className="text-sm font-medium text-blue-800 dark:text-blue-200">PDF de Correction</span>
                                  </div>
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    onClick={() => setPanelCollapsed(true)} 
                                    className="gap-2 bg-white/70 dark:bg-muted/40 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-800"
                                  >
                                    Fermer
                                  </Button>
                                </div>
                                {/* Mobile PDF Controls */}
                                <div className="flex items-center gap-2 px-3 py-2 border-b border-blue-200 dark:border-blue-800 bg-white/70 dark:bg-muted/40 text-xs flex-wrap flex-shrink-0">
                                  {correctionNumPages && <span className="text-blue-800 dark:text-blue-200 font-medium text-[11px]">{correctionNumPages} pages</span>}
                                  <Button variant="outline" size="sm" onClick={() => setCorrectionScale(s => Math.max(0.5, s - 0.2))} disabled={correctionScale <= 0.5}
                                    className="p-2 bg-white/70 dark:bg-muted/40 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-800"><ZoomOut className="h-3 w-3" /></Button>
                                  <span className="text-[11px] w-10 text-center text-blue-800 dark:text-blue-200 font-medium">{Math.round(correctionScale * 100)}%</span>
                                  <Button variant="outline" size="sm" onClick={() => setCorrectionScale(s => Math.min(3, s + 0.2))} disabled={correctionScale >= 3}
                                    className="p-2 bg-white/70 dark:bg-muted/40 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-800"><ZoomIn className="h-3 w-3" /></Button>
                                  <Button variant="outline" size="sm" onClick={() => setCorrectionRotation(r => (r + 90) % 360)}
                                    className="p-2 bg-white/70 dark:bg-muted/40 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-800"><RotateCw className="h-3 w-3" /></Button>
                                  <Button variant="outline" size="sm" onClick={fitCorrectionPage}
                                    className="px-2 text-[11px] bg-white/70 dark:bg-muted/40 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-800">Ajuster</Button>
                                </div>
                                <div className="flex-1 relative min-h-0">
                                  <div ref={correctionViewerRef} className="absolute inset-0 overflow-y-auto overflow-x-auto px-4 py-4">
                                    <PDFDoc
                                      file={correctionUrl}
                                      onLoadSuccess={({ numPages }) => { setCorrectionNumPages(numPages); setCorrectionLoading(false); setCorrectionError(null); }}
                                      onLoadError={(err) => { console.error(err); setCorrectionLoading(false); setCorrectionError('Erreur PDF.'); }}
                                      loading=""
                                      className="w-fit min-w-full flex flex-col items-center"
                                    >
                                      {correctionLoading && (
                                        <div className="flex items-center gap-2 py-4">
                                          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                                          <span className="text-blue-800 dark:text-blue-200 text-sm">Chargement...</span>
                                        </div>
                                      )}
                                      {correctionError && (
                                        <div className="text-sm text-blue-700 dark:text-blue-300 py-6">{correctionError}</div>
                                      )}
                                      {!correctionError && (correctionNumPages ? Array.from({ length: correctionNumPages }, (_, i) => (
                                        <div key={i} className="mb-6 last:mb-0">
                                          <PDFPage
                                            pageNumber={i + 1}
                                            scale={correctionScale}
                                            rotate={correctionRotation}
                                            className="shadow-xl bg-white rounded-lg border-2 border-blue-100 dark:border-blue-800"
                                            renderTextLayer={false}
                                            renderAnnotationLayer={false}
                                          />
                                        </div>
                                      )) : (
                                        <PDFPage
                                          pageNumber={1}
                                          scale={correctionScale}
                                          rotate={correctionRotation}
                                          className="shadow-xl bg-white rounded-lg border-2 border-blue-100 dark:border-blue-800"
                                          renderTextLayer={false}
                                          renderAnnotationLayer={false}
                                        />
                                      ))}
                                    </PDFDoc>
                                  </div>
                                </div>
                              </div>
                            )}
                            {/* Show Correction Zone only when correction mode is enabled and not showing PDF */}
                            {correctionModeEnabled && !showCorrectionPdf && canShowCorrectionZone && (
                              <div className="hidden sm:flex flex-1 flex-col h-full min-h-0">
                                <div className="flex-1 overflow-y-auto overflow-x-hidden correction-zone-scroll pr-1">
                                  <CorrectionZone 
                                    sessionId={session.id} 
                                    mode={mode} 
                                    onQuestionLink={handleQuestionLink}
                                    pdfLinks={pdfLinks}
                                    onNavigateToLink={scrollToLink}
                                    onUserModeChange={handleUserModeChange}
                                  />
                                </div>
                              </div>
                            )}
                            {/* Show Correction PDF when enabled OR when correction mode is disabled */}
                            {(showCorrectionPdf || !correctionModeEnabled) && canShowCorrectionPdf && correctionUrl && (
                              <div className="hidden sm:flex flex-col border border-blue-100 dark:border-blue-800 rounded-lg bg-gradient-to-br from-blue-50/60 via-white to-indigo-50/40 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex-1 min-h-0 overflow-hidden">
                                <div className="flex items-center gap-2 px-3 py-2 border-b border-blue-200 dark:border-blue-800 bg-white/70 dark:bg-muted/40 text-xs flex-wrap flex-shrink-0">
                                  {correctionNumPages && <span className="text-blue-800 dark:text-blue-200 font-medium text-[11px]">{correctionNumPages} pages</span>}
                                  <Button variant="outline" size="sm" onClick={() => setCorrectionScale(s => Math.max(0.5, s - 0.2))} disabled={correctionScale <= 0.5}
                                    className="p-2 bg-white/70 dark:bg-muted/40 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-800"><ZoomOut className="h-3 w-3" /></Button>
                                  <span className="text-[11px] w-10 text-center text-blue-800 dark:text-blue-200 font-medium">{Math.round(correctionScale * 100)}%</span>
                                  <Button variant="outline" size="sm" onClick={() => setCorrectionScale(s => Math.min(3, s + 0.2))} disabled={correctionScale >= 3}
                                    className="p-2 bg-white/70 dark:bg-muted/40 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-800"><ZoomIn className="h-3 w-3" /></Button>
                                  <Button variant="outline" size="sm" onClick={() => setCorrectionRotation(r => (r + 90) % 360)}
                                    className="p-2 bg-white/70 dark:bg-muted/40 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-800"><RotateCw className="h-3 w-3" /></Button>
                                  <Button variant="outline" size="sm" onClick={fitCorrectionPage}
                                    className="px-2 text-[11px] bg-white/70 dark:bg-muted/40 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-800">Ajuster</Button>
                                </div>
                                <div className="flex-1 relative min-h-0">
                                  <div ref={correctionViewerRef} className="absolute inset-0 overflow-y-auto overflow-x-auto px-4 py-4">
                                    <PDFDoc
                                      file={correctionUrl}
                                      onLoadSuccess={({ numPages }) => { setCorrectionNumPages(numPages); setCorrectionLoading(false); setCorrectionError(null); }}
                                      onLoadError={(err) => { console.error(err); setCorrectionLoading(false); setCorrectionError('Erreur PDF.'); }}
                                      loading=""
                                      className="w-fit min-w-full flex flex-col items-center"
                                    >
                                      {correctionLoading && (
                                        <div className="flex items-center gap-2 py-4">
                                          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                                          <span className="text-blue-800 dark:text-blue-200 text-sm">Chargement...</span>
                                        </div>
                                      )}
                                      {correctionError && (
                                        <div className="text-sm text-blue-700 dark:text-blue-300 py-6">{correctionError}</div>
                                      )}
                                      {!correctionError && (correctionNumPages ? Array.from({ length: correctionNumPages }, (_, i) => (
                                        <div key={i} className="mb-6 last:mb-0">
                                          <PDFPage
                                            pageNumber={i + 1}
                                            scale={correctionScale}
                                            rotate={correctionRotation}
                                            className="shadow-xl bg-white rounded-lg border-2 border-blue-100 dark:border-blue-800"
                                            renderTextLayer={false}
                                            renderAnnotationLayer={false}
                                          />
                                        </div>
                                      )) : (
                                        <PDFPage
                                          pageNumber={1}
                                          scale={correctionScale}
                                          rotate={correctionRotation}
                                          className="shadow-xl bg-white rounded-lg border-2 border-blue-100 dark:border-blue-800"
                                          renderTextLayer={false}
                                          renderAnnotationLayer={false}
                                        />
                                      ))}
                                    </PDFDoc>
                                  </div>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </div>
                )}
                {/* Render CorrectionZone on mobile for floating button only when correction mode is ON */}
                {session && correctionModeEnabled && canShowCorrectionZone && (
                  <div className="block sm:hidden">
                    <CorrectionZone 
                      sessionId={session.id} 
                      mode={mode} 
                      onQuestionLink={handleQuestionLink}
                      pdfLinks={pdfLinks}
                      onNavigateToLink={scrollToLink}
                      onUserModeChange={handleUserModeChange}
                    />
                  </div>
                )}
                {canShowCorrectionPdf && correctionUrl && panelCollapsed && <FloatingCorrectionButton onClick={() => { setPanelCollapsed(false); setShowCorrectionPdf(true); }} />}
                </div>
              </div>
            </SidebarInset>
          </div>
            </PDFProvider>
          )}
        </SidebarOpenConsumer>
      </AppSidebarProvider>
    </ProtectedRoute>
  );
}

function SidebarOpenConsumer({ children }: { children: (open: boolean) => React.ReactNode }) {
  const { open } = useSidebar();
  return <>{children(open)}</>;
}

function FloatingCorrectionButton({ onClick }: { onClick: () => void }) {
  const { open } = useSidebar();
  return (
    <Button
      onClick={onClick}
      variant="default"
      className={`fixed bottom-6 shadow-xl rounded-full px-6 py-6 flex items-center gap-2 z-40 bg-blue-600 hover:bg-blue-700 text-white border-2 border-blue-200 dark:border-blue-800 transition-all duration-300 ${open ? 'left-[calc(16rem+1.5rem)]' : 'left-12'}`}
    >
      <FileCheck2 className="h-5 w-5" />
      <span className="hidden sm:inline text-sm font-medium">Correction PDF</span>
    </Button>
  );
}
