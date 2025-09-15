'use client';

import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, UploadCloud, RotateCcw, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

type SessionRow = {
  name: string;
  pdfUrl?: string;
  correctionUrl?: string;
  niveau?: string;
  semestre?: string | number;
  specialty?: string;
};

const normalizeDriveLink = (raw?: string): string | undefined => {
  if (!raw) return undefined;
  const link = raw.trim();
  if (!link) return undefined;
  if (/\.pdf($|[?#])/i.test(link)) return link;
  if (/drive\.google\.com\/uc\?export=download&id=/i.test(link)) return link;
  const driveRegex = /https?:\/\/drive\.google\.com\/(?:file\/d\/|open\?id=)([a-zA-Z0-9_-]+)/i;
  const match = link.match(driveRegex);
  if (match) return `https://drive.google.com/uc?export=download&id=${match[1]}`;
  return link;
};

export function SessionImportPanel() {
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [niveaux, setNiveaux] = useState<{ id: string; name: string }[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [specialties, setSpecialties] = useState<{ id: string; name: string }[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [importSummary, setImportSummary] = useState<{ ok: number; fail: number; total: number; errors: string[] } | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/niveaux');
        if (res.ok) setNiveaux(await res.json());
        const specs = await fetch('/api/specialties/list');
        if (specs.ok) setSpecialties(await specs.json());
      } catch {}
    };
    load();
  }, []);

  const parseCSVLike = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length <= 1) { setRows([]); return; }
    const out: SessionRow[] = [];
    for (const line of lines.slice(1)) {
      const cols = line.split(',');
      const [name, pdfUrl, correctionUrl, niveau, semestre, specialty] = cols.map(c => c?.trim());
      if (!name) continue;
      out.push({
        name,
        pdfUrl: normalizeDriveLink(pdfUrl),
        correctionUrl: normalizeDriveLink(correctionUrl),
        niveau,
        semestre,
        specialty
      });
    }
    setRows(out);
  };

  const parseXLSX = async (file: File) => {
    const buf = await file.arrayBuffer();
    const workbook = XLSX.read(buf, { type: 'array' });
    const firstSheet = workbook.SheetNames[0];
    const ws = workbook.Sheets[firstSheet];
    const ref = ws['!ref'];
    if (!ref) { setRows([]); return; }
    const range = XLSX.utils.decode_range(ref as string);
    const norm = (s: string) => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');
    const alias: Record<string, keyof SessionRow> = {
      name: 'name', nom: 'name', titre: 'name',
      pdf: 'pdfUrl', pdfurl: 'pdfUrl', lienpdf: 'pdfUrl',
      correction: 'correctionUrl', correctionurl: 'correctionUrl', liencorrection: 'correctionUrl',
      niveau: 'niveau', level: 'niveau', semestre: 'semestre', semester: 'semestre',
      speciality: 'specialty', specialty: 'specialty', matiere: 'specialty', specialite: 'specialty'
    };
    const headerRow = range.s.r;
    const colMap: Record<number, keyof SessionRow | undefined> = {};
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ c, r: headerRow })];
      if (!cell) continue;
      colMap[c] = alias[norm(String(cell.v || ''))];
    }
    const out: SessionRow[] = [];
    for (let r = headerRow + 1; r <= range.e.r; r++) {
      const acc: SessionRow = { name: '' };
      let empty = true;
      for (let c = range.s.c; c <= range.e.c; c++) {
        const key = colMap[c];
        if (!key) continue;
        const cell: any = ws[XLSX.utils.encode_cell({ c, r })];
        if (!cell) continue;
        const raw = (cell.v != null ? String(cell.v) : '').trim();
        if (raw) empty = false;
        let value = raw;
        if ((key === 'pdfUrl' || key === 'correctionUrl') && cell.l && cell.l.Target) value = cell.l.Target;
        if (key === 'pdfUrl') acc.pdfUrl = normalizeDriveLink(value);
        else if (key === 'correctionUrl') acc.correctionUrl = normalizeDriveLink(value);
        else if (key === 'niveau') acc.niveau = value;
        else if (key === 'semestre') acc.semestre = value;
        else if (key === 'specialty') acc.specialty = value;
        else if (key === 'name') acc.name = value;
      }
      if (!empty && acc.name) out.push(acc);
    }
    setRows(out);
  };

  const handleImport = async () => {
    if (!rows.length) return;
    setIsUploading(true);
    setImportSummary(null);
    try {
      let ok = 0; let fail = 0; const errors: string[] = [];
      const normNiveau = (s: string) => s.toLowerCase().replace(/\s|-/g, '');
      for (const r of rows) {
        let niveauId: string | undefined;
        if (r.niveau) {
          let match = niveaux.find(n => n.name.toLowerCase() === r.niveau!.toLowerCase());
          if (!match) {
            const target = normNiveau(r.niveau);
            match = niveaux.find(n => normNiveau(n.name) === target);
          }
          if (!match) {
            const m = r.niveau.match(/^(PCEM|DCEM)\s?(\d)$/i);
            if (m) {
              const compact = (m[1] + m[2]).toUpperCase();
              match = niveaux.find(n => n.name.toUpperCase() === compact);
            }
          }
          if (match) niveauId = match.id;
        }
        const res = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: r.name,
            pdfUrl: normalizeDriveLink(r.pdfUrl),
            correctionUrl: normalizeDriveLink(r.correctionUrl),
            niveauId,
            semester: (() => {
              if (!r.semestre) return undefined;
              const raw = String(r.semestre).trim();
              const m = raw.match(/S?\s*(\d)/i);
              if (m) return m[1];
              const d = parseInt(raw, 10);
              if (!isNaN(d)) return d;
              return raw;
            })(),
            specialtyName: r.specialty
          })
        });
        if (res.ok) ok++; else {
          fail++;
          let msg = '';
          try { const j = await res.clone().json(); msg = j?.error || j?.message || JSON.stringify(j); } catch { try { msg = await res.text(); } catch {} }
          errors.push(`${r.name}: ${msg || res.statusText}`);
        }
      }
      setImportSummary({ ok, fail, total: rows.length, errors });
      if (fail === 0) toast({ title: 'Import terminé', description: `${ok}/${rows.length} sessions importées.` });
      else toast({ title: 'Import terminé avec erreurs', description: `${ok} succès, ${fail} échecs`, variant: 'destructive' });
    } finally { setIsUploading(false); }
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.csv')) return parseCSVLike(file);
    if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return parseXLSX(file);
    return parseCSVLike(file);
  };

  const hasRows = rows.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importer des sessions (examens)</CardTitle>
        <CardDescription>Colonnes attendues: name, pdfUrl, correctionUrl, niveau (opt), semestre (opt), specialty (opt)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Fichier</Label>
          <div
            className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer select-none ${isDragOver ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' : 'border-muted-foreground/25 hover:border-muted-foreground/50'}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) void handleFile(f); }}
            onClick={() => document.getElementById('sessions-file-input')?.dispatchEvent(new MouseEvent('click'))}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') document.getElementById('sessions-file-input')?.dispatchEvent(new MouseEvent('click')); }}
          >
            <div className="flex flex-col items-center gap-2">
              <UploadCloud className={`h-6 w-6 ${isDragOver ? 'text-blue-600' : 'text-muted-foreground'}`} />
              <div className="text-sm">Glisser / déposer ou cliquer pour choisir</div>
              <div className="text-xs text-muted-foreground">Formats: .xlsx, .xls, .csv</div>
              {fileName && <div className="text-xs text-muted-foreground mt-1">Sélectionné: {fileName}</div>}
            </div>
            <input id="sessions-file-input" type="file" accept=".csv,.xls,.xlsx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }} />
          </div>
        </div>
        {importSummary ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <CheckCircle2 className={`h-10 w-10 ${importSummary.fail ? 'text-yellow-500' : 'text-green-500'}`} />
            <div className="text-lg font-medium">Import terminé</div>
            <div className="text-sm text-muted-foreground">{importSummary.ok}/{importSummary.total} succès{importSummary.fail ? `, ${importSummary.fail} échecs` : ''}</div>
            {importSummary.errors.length > 0 && (
              <div className="w-full max-w-xl text-xs bg-destructive/10 border border-destructive/30 rounded p-3 space-y-1 overflow-auto max-h-48">
                {importSummary.errors.map((e, i) => <div key={i}>• {e}</div>)}
              </div>
            )}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => { setRows([]); setImportSummary(null); setFileName(''); }}>Nouvel import</Button>
              <Button variant="secondary" onClick={() => setImportSummary(null)}>Voir les lignes</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <Button onClick={handleImport} disabled={!rows.length || isUploading}>
                <Upload className="h-4 w-4 mr-2" /> Importer
              </Button>
              <div className="text-sm text-muted-foreground">{rows.length} lignes prêtes</div>
              {rows.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => { setRows([]); setFileName(''); }}>
                  <RotateCcw className="h-4 w-4 mr-1" /> Réinitialiser
                </Button>
              )}
            </div>
            {hasRows && (
              <div className="border rounded-md relative">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>PDF</TableHead>
                      <TableHead>Correction</TableHead>
                      <TableHead>Niveau</TableHead>
                      <TableHead>Semestre</TableHead>
                      <TableHead>Spécialité</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 50).map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="truncate max-w-[220px]">{r.pdfUrl}</TableCell>
                        <TableCell className="truncate max-w-[220px]">{r.correctionUrl}</TableCell>
                        <TableCell>{r.niveau || '-'}</TableCell>
                        <TableCell>{r.semestre || '-'}</TableCell>
                        <TableCell>{r.specialty || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {rows.length > 50 && <div className="text-xs text-muted-foreground px-3 py-2">Affichage des 50 premières sur {rows.length}</div>}
              </div>
            )}
          </>
        )}
      </CardContent>
      {isUploading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4 rounded-md">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <div className="text-sm text-muted-foreground">Import des sessions…</div>
        </div>
      )}
    </Card>
  );
}
