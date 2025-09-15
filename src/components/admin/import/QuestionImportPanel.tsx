'use client';

// Extracted from original /admin/import/page.tsx and converted to French static labels
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, FileText, AlertCircle, CheckCircle, XCircle, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { read, utils } from 'xlsx';

const SUPPORTED_MIME = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel'
];
const MAX_FILE_SIZE_MB = 8;
const PREVIEW_LIMIT = 10;

const safeParseInt = (value: string): number | null => {
  if (value === undefined || value === null) return null;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
};

function extractImageUrlAndCleanText(text: string): { cleanedText: string; mediaUrl: string | null; mediaType: string | null } {
  const imageUrlRegex = /(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp|svg|bmp|tiff|ico))(\s|$)/gi;
  let cleanedText = text;
  let mediaUrl: string | null = null;
  let mediaType: string | null = null;
  const match = imageUrlRegex.exec(text);
  if (match) {
    mediaUrl = match[1];
    cleanedText = text.replace(match[0], '').trim();
    const extension = mediaUrl.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'jpg':
      case 'jpeg': mediaType = 'image/jpeg'; break;
      case 'png': mediaType = 'image/png'; break;
      case 'gif': mediaType = 'image/gif'; break;
      case 'webp': mediaType = 'image/webp'; break;
      case 'svg': mediaType = 'image/svg+xml'; break;
      case 'bmp': mediaType = 'image/bmp'; break;
      case 'tiff': mediaType = 'image/tiff'; break;
      case 'ico': mediaType = 'image/x-icon'; break;
      default: mediaType = 'image';
    }
  }
  return { cleanedText, mediaUrl, mediaType };
}

interface Lecture { id: string; title: string; specialty: { id: string; name: string }; }
interface ImportPreview { totalQuestions: number; matchedLectures: number; unmatchedLectures: number; specialties: string[]; sheets: { [sheetName: string]: { totalQuestions: number; questionType: string; previewData: Array<any>; }; }; }
interface ImportProgress { progress: number; phase: 'validating' | 'importing' | 'complete'; message: string; logs: string[]; stats?: Record<string, unknown>; }
interface SheetError { sheet: string; missingHeaders?: string[]; message: string; }
interface ImportStats { total: number; imported: number; failed: number; createdSpecialties: number; createdLectures: number; createdCases: number; questionsWithImages: number; errors?: string[]; }

export function QuestionImportPanel() {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [importResult, setImportResult] = useState<ImportStats | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [specialties, setSpecialties] = useState<{ id: string; name: string }[]>([]);
  const [sheetErrors, setSheetErrors] = useState<SheetError[]>([]);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activeImportRef = useRef<boolean>(false);
  const abortControllersRef = useRef<AbortController[]>([]);

  const fetchData = async () => {
    try {
      const [lecturesRes, specialtiesRes] = await Promise.all([
        fetch('/api/lectures'),
        fetch('/api/specialties')
      ]);
      if (lecturesRes.ok) setLectures(await lecturesRes.json());
      if (specialtiesRes.ok) setSpecialties(await specialtiesRes.json());
    } catch {}
  };
  useEffect(() => { fetchData(); }, []);
  useEffect(() => () => { activeImportRef.current = false; if (pollingTimeoutRef.current) clearTimeout(pollingTimeoutRef.current); abortControllersRef.current.forEach(c => c.abort()); }, []);

  const findMatchingLecture = (matiere: string, cours: string): Lecture | undefined => {
    const specialty = specialties.find(s => s.name.toLowerCase().includes(matiere.toLowerCase()) || matiere.toLowerCase().includes(s.name.toLowerCase()));
    if (!specialty) return undefined;
    return lectures.find(l => l.specialty.id === specialty.id && (l.title.toLowerCase().includes(cours.toLowerCase()) || cours.toLowerCase().includes(l.title.toLowerCase())));
  };

  const handleFileSelect = async (file: File) => {
    setSheetErrors([]); setImportPreview(null); setImportResult(null); setProgress(null);
    if (!SUPPORTED_MIME.includes(file.type) && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) { toast({ title: 'Erreur', description: 'Type de fichier non supporté.', variant: 'destructive' }); return; }
    const sizeMB = file.size / (1024 * 1024); if (sizeMB > MAX_FILE_SIZE_MB) { toast({ title: 'Erreur', description: `Fichier trop grand (${sizeMB.toFixed(1)}MB > ${MAX_FILE_SIZE_MB}MB)`, variant: 'destructive' }); return; }
    setSelectedFile(file);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = read(arrayBuffer, { type: 'array' });
      const sheets = ['qcm', 'qroc', 'cas_qcm', 'cas_qroc'] as const;
      const sheetsData: Record<string, { totalQuestions: number; questionType: string; previewData: Array<any>; }> = {};
      const uniqueSpecialties = new Set<string>();
      const matchedLectures = new Set<string>();
      const unmatchedLectures = new Set<string>();
      const newSheetErrors: SheetError[] = [];
      for (const sheetName of sheets) {
        if (!workbook.Sheets[sheetName]) continue;
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = utils.sheet_to_json(worksheet, { header: 1 });
        if (jsonData.length < 2) continue;
        const headerRow = jsonData[0] as string[];
        const header = headerRow.map(h => h?.toString().trim().toLowerCase() || '');
        let expectedHeaders: string[] = []; let questionType = '';
        switch (sheetName) {
          case 'qcm': expectedHeaders = ['matiere', 'cours', 'question n', 'source', 'texte de la question', 'option a', 'option b', 'option c', 'option d', 'option e', 'reponse']; questionType = 'QCM'; break;
          case 'qroc': expectedHeaders = ['matiere', 'cours', 'question n', 'source', 'texte de la question', 'reponse']; questionType = 'QROC'; break;
          case 'cas_qcm': expectedHeaders = ['matiere', 'cours', 'cas n', 'source', 'texte du cas', 'question n', 'texte de question', 'option a', 'option b', 'option c', 'option d', 'option e', 'reponse']; questionType = 'Cas clinique QCM'; break;
          case 'cas_qroc': expectedHeaders = ['matiere', 'cours', 'cas n', 'source', 'texte du cas', 'question n', 'texte de question', 'reponse']; questionType = 'Cas clinique QROC'; break; }
        const missingHeaders = expectedHeaders.filter(h => !header.includes(h)); if (missingHeaders.length > 0) { newSheetErrors.push({ sheet: sheetName, missingHeaders, message: `En-têtes manquants: ${missingHeaders.join(', ')}` }); continue; }
        const previewData: any[] = []; let validQuestionCount = 0; const questionTextColumn = (sheetName === 'cas_qcm' || sheetName === 'cas_qroc') ? 'texte de question' : 'texte de la question';
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i] as unknown[]; if (!row || row.length === 0) continue; const values = row.map(cell => cell?.toString().trim() || '');
          const rowData: Record<string, string> = {}; header.forEach((h, idx) => { rowData[h] = values[idx] || ''; });
          const hasCore = rowData['matiere'] && rowData['cours'] && rowData[questionTextColumn]; if (!hasCore) continue; validQuestionCount++;
          uniqueSpecialties.add(rowData['matiere']); const lectureKey = `${rowData['matiere']}:${rowData['cours']}`; const matchedLecture = findMatchingLecture(rowData['matiere'], rowData['cours']); if (matchedLecture) matchedLectures.add(lectureKey); else unmatchedLectures.add(lectureKey);
          if (previewData.length < PREVIEW_LIMIT) {
            const { cleanedText, mediaUrl, mediaType } = extractImageUrlAndCleanText(rowData[questionTextColumn]);
            const questionNumber = safeParseInt(rowData['question n']);
            const previewItem: any = { matiere: rowData['matiere'], cours: rowData['cours'], questionNumber: questionNumber ?? 0, questionText: cleanedText, matchedLecture, mediaUrl, mediaType, explanation: rowData['explication'] || undefined, niveau: rowData['niveau'] || undefined, semestre: rowData['semestre'] || undefined };
            if (rowData['rappel']) previewItem.rappel = rowData['rappel'];
            if (sheetName === 'cas_qcm' || sheetName === 'cas_qroc') { previewItem.caseNumber = safeParseInt(rowData['cas n']) ?? undefined; previewItem.caseText = rowData['texte du cas'] || undefined; previewItem.caseQuestionNumber = questionNumber ?? undefined; }
            if (sheetName === 'qcm' || sheetName === 'cas_qcm') { const options: string[] = []; const optionExplanations: string[] = []; for (let j = 0; j < 5; j++) { const optionKey = `option ${String.fromCharCode(97 + j)}`; if (rowData[optionKey]) options.push(rowData[optionKey]); const expKey = `explication ${String.fromCharCode(97 + j)}`; if (rowData[expKey]) optionExplanations.push(rowData[expKey]); } previewItem.options = options; if (rowData['reponse']) { const raw = rowData['reponse'].toString().toUpperCase(); const parts = raw.split(/[;,\s]+/).filter(p => p.trim()); const mapped: string[] = []; parts.forEach(letter => { const idx = letter.charCodeAt(0) - 65; if (idx >= 0 && idx < options.length) mapped.push(idx.toString()); }); previewItem.correctAnswers = mapped.length ? mapped : [rowData['reponse']]; } else previewItem.correctAnswers = []; if (optionExplanations.length) previewItem.optionExplanations = optionExplanations; }
            previewData.push(previewItem);
          }
        }
        if (validQuestionCount > 0) sheetsData[sheetName] = { totalQuestions: validQuestionCount, questionType, previewData };
      }
      if (Object.keys(sheetsData).length === 0) { setSheetErrors(prev => [...prev, ...newSheetErrors]); toast({ title: 'Erreur', description: newSheetErrors.length > 0 ? 'Toutes les feuilles invalides ou en-têtes manquants.' : 'Aucune feuille valide trouvée.', variant: 'destructive' }); return; }
      setSheetErrors(newSheetErrors);
      setImportPreview({ totalQuestions: Object.values(sheetsData).reduce((sum: number, sheet) => sum + sheet.totalQuestions, 0), matchedLectures: matchedLectures.size, unmatchedLectures: unmatchedLectures.size, specialties: Array.from(uniqueSpecialties), sheets: sheetsData });
    } catch (error) { console.error('Parsing error', error); toast({ title: 'Erreur', description: 'Erreur de parsing du fichier Excel.', variant: 'destructive' }); }
  };

  const onDragOver: React.DragEventHandler = (e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy'; if (!isDragging) setIsDragging(true); };
  const onDragEnter: React.DragEventHandler = (e) => { e.preventDefault(); e.stopPropagation(); if (!isDragging) setIsDragging(true); };
  const onDragLeave: React.DragEventHandler = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const onDrop: React.DragEventHandler = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); const dt = e.dataTransfer; if (!dt) return; const file = dt.files && dt.files.length > 0 ? dt.files[0] : null; if (file) { if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) { void handleFileSelect(file); } } };

  const handleUpload = async () => {
    if (!selectedFile) { toast({ title: 'Erreur', description: 'Veuillez sélectionner un fichier', variant: 'destructive' }); return; }
    if (sheetErrors.some(e => e.missingHeaders)) { toast({ title: 'Erreur', description: 'Corrigez les en-têtes avant import.', variant: 'destructive' }); return; }
    setIsUploading(true); setProgress(null); setImportResult(null); activeImportRef.current = true;
    try {
      const optionsController = new AbortController(); abortControllersRef.current.push(optionsController); await fetch('/api/questions/bulk-import-progress', { method: 'OPTIONS', signal: optionsController.signal });
      setProgress({ progress: 0, phase: 'validating', message: 'Validation…', logs: [] });
      const formData = new FormData(); formData.append('file', selectedFile);
      const uploadController = new AbortController(); abortControllersRef.current.push(uploadController); const response = await fetch('/api/questions/bulk-import-progress', { method: 'POST', body: formData, signal: uploadController.signal });
      if (!response.ok) { const txt = await response.text(); throw new Error(txt || 'Échec upload'); }
      let responseData: Record<string, unknown> = {}; try { responseData = await response.json(); } catch { throw new Error('Réponse JSON invalide'); }
      const importId = responseData?.importId as string; if (!importId) throw new Error('importId manquant');
      await new Promise(r => setTimeout(r, 400));
      const poll = async () => {
        if (!activeImportRef.current) return;
        try {
          const controller = new AbortController(); abortControllersRef.current.push(controller);
          const res = await fetch(`/api/questions/bulk-import-progress?importId=${encodeURIComponent(importId)}`, { signal: controller.signal });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json(); if (!activeImportRef.current) return; setProgress(data);
          if (data.progress < 100) { pollingTimeoutRef.current = setTimeout(poll, 1000); }
          else { activeImportRef.current = false; setImportResult(data.stats as ImportStats); setIsUploading(false); if (data.stats?.failed > 0) toast({ title: 'Import terminé (erreurs)', description: `${data.stats.imported}/${data.stats.total} questions importées`, variant: 'default' }); else toast({ title: 'Import réussi', description: `${data.stats.imported}/${data.stats.total} questions importées`, variant: 'default' }); }
        } catch (err) { if (!activeImportRef.current) return; console.error('Polling error', err); setIsUploading(false); activeImportRef.current = false; toast({ title: 'Erreur', description: 'Échec import.', variant: 'destructive' }); }
      }; poll();
    } catch (e: any) { activeImportRef.current = false; setIsUploading(false); toast({ title: 'Erreur', description: e?.message || 'Import impossible', variant: 'destructive' }); }
  };

  const handleReset = () => { activeImportRef.current = false; if (pollingTimeoutRef.current) clearTimeout(pollingTimeoutRef.current); abortControllersRef.current.forEach(c => c.abort()); abortControllersRef.current = []; setSelectedFile(null); setImportPreview(null); setImportResult(null); setProgress(null); setSheetErrors([]); setIsUploading(false); };

  return (
    <div className="space-y-6">
      {!selectedFile ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Upload className="h-5 w-5" /> Sélectionner un fichier Excel
            </CardTitle>
            <CardDescription>Feuilles attendues: qcm, qroc, cas_qcm, cas_qroc</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center w-full">
              <label className={`flex flex-col items-center justify-center w-full h-56 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isDragging ? 'bg-primary/10 border-primary' : 'bg-muted/50 hover:bg-muted/80'}`} onDragOver={onDragOver} onDragEnter={onDragEnter} onDragLeave={onDragLeave} onDrop={onDrop}>
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 mb-4 text-muted-foreground" />
                  <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Glisser / déposer ou cliquer</span></p>
                  <p className="text-xs text-muted-foreground">Formats acceptés: XLSX / XLS</p>
                </div>
                <input type="file" className="hidden" accept=".xlsx,.xls" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileSelect(file); }} />
              </label>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-5 w-5" /> {selectedFile.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div><p className="text-xs font-medium">Total questions</p><p className="text-xl font-bold">{importPreview?.totalQuestions || 0}</p></div>
                <div><p className="text-xs font-medium">Spécialités</p><p className="text-xl font-bold">{importPreview?.specialties.length || 0}</p></div>
                <div><p className="text-xs font-medium">Cours trouvés</p><p className="text-xl font-bold text-green-600">{importPreview?.matchedLectures || 0}</p></div>
                <div><p className="text-xs font-medium">Cours manquants</p><p className="text-xl font-bold text-orange-600">{importPreview?.unmatchedLectures || 0}</p></div>
              </div>
            </CardContent>
          </Card>

          {sheetErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{sheetErrors.map((e, i) => <div key={i} className="text-[11px]"><strong>{e.sheet}</strong>: {e.message}</div>)}</AlertDescription>
            </Alert>
          )}

          {importPreview && (
            <Collapsible>
              <Card>
                <CardHeader>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between p-0 h-auto">
                      <div className="text-left">
                        <CardTitle className="text-lg">Aperçu</CardTitle>
                        <CardDescription>Premières 10 questions par feuille</CardDescription>
                      </div>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent>
                    <div className="space-y-6">
                      {Object.entries(importPreview.sheets).map(([sheetName, sheetData]) => {
                        const typedSheet: any = sheetData;
                        return (
                          <div key={sheetName} className="space-y-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-base font-semibold capitalize">{sheetName.replace('_', ' ')}</h3>
                              <Badge variant="outline">{typedSheet.questionType}</Badge>
                              <Badge variant="secondary">{typedSheet.totalQuestions} questions</Badge>
                            </div>
                            <div className="space-y-2">
                              {typedSheet.previewData.map((item: any, idx: number) => (
                                <div key={idx} className="flex items-start gap-3 p-3 border rounded-lg">
                                  <div className="flex-shrink-0">{item.matchedLecture ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-orange-500" />}</div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                      <Badge variant={item.matchedLecture ? 'default' : 'secondary'}>{item.matiere}</Badge>
                                      <Badge variant={item.matchedLecture ? 'default' : 'secondary'}>{item.cours}</Badge>
                                      <Badge variant="outline">#{item.questionNumber}</Badge>
                                      {item.caseNumber && <Badge variant="outline">Cas {item.caseNumber}</Badge>}
                                    </div>
                                    {item.caseText && <div className="mb-2 p-2 bg-muted rounded text-[11px]"><strong>Cas:</strong> {item.caseText.substring(0, 100)}...</div>}
                                    <p className="text-xs text-muted-foreground line-clamp-2">{item.questionText}</p>
                                    {item.options && item.options.length > 0 && (
                                      <div className="mt-2 space-y-1">
                                        <p className="text-[11px] font-semibold">Options:</p>
                                        {item.options.map((opt: string, oIdx: number) => (
                                          <p key={oIdx} className="text-[11px] text-muted-foreground ml-2">{String.fromCharCode(65 + oIdx)}. {opt}</p>
                                        ))}
                                      </div>
                                    )}
                                    {item.mediaUrl && <p className="text-[11px] text-muted-foreground mt-1"><span className="font-semibold">Image:</span> {item.mediaUrl}</p>}
                                    {item.explanation && <p className="text-[11px] text-muted-foreground mt-1"><span className="font-semibold">Explication:</span> {item.explanation.substring(0, 120)}{item.explanation.length > 120 ? '…' : ''}</p>}
                                    {item.rappel && <p className="text-[11px] text-muted-foreground mt-1"><span className="font-semibold">Rappel:</span> {item.rappel.substring(0,100)}{item.rappel.length>100?'…':''}</p>}
                                    {(item.niveau || item.semestre) && <p className="text-[11px] text-muted-foreground mt-1"><span className="font-semibold">Niveau/Semestre:</span> {[item.niveau, item.semestre].filter(Boolean).join(' • ')}</p>}
                                    <p className="text-[11px] text-muted-foreground mt-1">{item.matchedLecture ? 'Cours associé' : 'Cours manquant'}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {importPreview.unmatchedLectures > 0 && (
                      <Alert className="mt-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>Certains cours non trouvés – ils seront créés automatiquement.</AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          {progress && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  {progress.phase === 'validating' && <FileText className="h-5 w-5" />}
                  {progress.phase === 'importing' && <Upload className="h-5 w-5 animate-pulse" />}
                  {progress.phase === 'complete' && <CheckCircle className="h-5 w-5 text-green-500" />}
                  {progress.message} ({progress.progress.toFixed(1)}%)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs"><span>Progression</span><span>{progress.progress.toFixed(1)}%</span></div>
                  <Progress value={progress.progress} />
                </div>
                {progress.logs.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between"><h4 className="text-sm font-medium">Logs</h4><Badge variant="outline">{progress.logs.length}</Badge></div>
                    <ScrollArea className="h-40 border rounded-md p-3 bg-muted/50">
                      <div className="space-y-1">{progress.logs.map((log, i) => <div key={i} className="text-[11px] font-mono text-muted-foreground">{log}</div>)}</div>
                    </ScrollArea>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {!!importResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><CheckCircle className="h-5 w-5 text-green-500" /> Résultats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div><p className="text-xs font-medium">Total</p><p className="text-xl font-bold">{importResult.total}</p></div>
                  <div><p className="text-xs font-medium">Importées</p><p className="text-xl font-bold text-green-600">{importResult.imported}</p></div>
                  <div><p className="text-xs font-medium">Échecs</p><p className="text-xl font-bold text-red-600">{importResult.failed}</p></div>
                  <div><p className="text-xs font-medium">Spécialités créées</p><p className="text-xl font-bold text-blue-600">{importResult.createdSpecialties}</p></div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                  {importResult.createdLectures > 0 && <div><p className="text-xs font-medium">Cours créés</p><p className="text-lg font-bold text-blue-600">{importResult.createdLectures}</p></div>}
                  {importResult.createdCases > 0 && <div><p className="text-xs font-medium">Cas cliniques</p><p className="text-lg font-bold text-indigo-600">{importResult.createdCases}</p></div>}
                  {importResult.questionsWithImages > 0 && <div><p className="text-xs font-medium">Questions avec images</p><p className="text-lg font-bold text-blue-600">{importResult.questionsWithImages}</p></div>}
                </div>
                {importResult.errors && importResult.errors.length > 0 && (
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" className="w-full"><AlertCircle className="h-4 w-4 mr-2" /> Voir erreurs ({importResult.errors.length}) <ChevronDown className="h-4 w-4 ml-auto" /></Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-4 p-4 border rounded-lg bg-muted/50">
                        <ScrollArea className="h-56">
                          <div className="space-y-1">{importResult.errors.map((e, i) => <div key={i} className="text-[11px] text-red-600">{e}</div>)}</div>
                        </ScrollArea>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            {!isUploading && !importResult && (
              <Button onClick={handleUpload} className="w-full sm:flex-1" disabled={sheetErrors.length > 0}><Upload className="h-4 w-4 mr-2" /> Importer les questions</Button>
            )}
            {isUploading && (
              <Button variant="outline" onClick={handleReset} disabled={!isUploading} className="w-full sm:w-auto">Annuler</Button>
            )}
            {!isUploading && (
              <Button variant="outline" onClick={handleReset} className="w-full sm:w-auto">{importResult ? 'Importer un autre fichier' : 'Réinitialiser'}</Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
