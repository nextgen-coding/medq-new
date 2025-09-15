"use client";
import { useEffect, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

interface QuickParseQrocProps {
  questionText: string;
  answer: string; // current reference answer (for qroc / clinic_croq stored outside)
  setQuestionText: (t: string) => void;
  setAnswer: (a: string) => void; // sets correctAnswers[0] or qrocAnswer
  autoPrefill?: boolean; // prefill textarea with existing question+answer
  className?: string;
  title?: string;
  copyLabel?: string;
}

// Shared quick parse component for QROC editing & creation.
// Paste format examples:
//  Texte de la question...
//  Réponse: la réponse attendue
// If no delimiter line is found, the last non-empty line becomes the answer.
export function QuickParseQroc({
  questionText,
  answer,
  setQuestionText,
  setAnswer,
  autoPrefill = true,
  className,
  title = 'Parse rapide QROC',
  copyLabel = 'Copier actuel'
}: QuickParseQrocProps) {
  const [raw, setRaw] = useState('');

  // Prefill once with existing values (edit mode) so user can copy / tweak easily
  useEffect(() => {
    if (!autoPrefill) return;
    // Only prefill if user hasn't typed anything yet
    if (raw.trim().length === 0 && (questionText || answer)) {
      const lines: string[] = [];
      if (questionText) lines.push(questionText.trim());
      if (answer) lines.push(`Réponse: ${answer}`);
      setRaw(lines.join('\n'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionText, answer]);

  const parse = () => {
    if (!raw.trim()) {
      toast({ title: 'Vide', description: 'Collez d\'abord le texte.' });
      return;
    }
    const delims = ['Réponse :', 'Réponse:', 'Reponse :', 'Reponse:', 'Answer:', 'Answer :'];
    let q = raw.trim();
    let ans = '';
    for (const d of delims) {
      const idx = raw.indexOf(d);
      if (idx !== -1) {
        q = raw.slice(0, idx).trim();
        ans = raw.slice(idx + d.length).trim();
        break;
      }
    }
    if (!ans) {
      const lines = raw.split(/\n+/).map(l => l.trim()).filter(Boolean);
      if (lines.length > 1) {
        ans = lines.pop() as string;
        q = lines.join('\n').trim();
      }
    }
    if (q) setQuestionText(q);
    if (ans) setAnswer(ans);
    toast({ title: 'Analyse effectuée', description: ans ? 'Question & réponse mises à jour.' : 'Question mise à jour (pas de réponse détectée).' });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Q: ${questionText}\nRéponse: ${answer || ''}`);
      toast({ title: 'Copié', description: 'Question + réponse copiées.' });
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de copier', variant: 'destructive' });
    }
  };

  return (
    <div className={`space-y-2 border rounded-md p-3 bg-muted/30 ${className || ''}`}> 
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Button type="button" variant="outline" size="sm" onClick={copy}>{copyLabel}</Button>
      </div>
      <Textarea
        value={raw}
        onChange={e => setRaw(e.target.value)}
        placeholder={`Collez ici.\nExemple:\nTexte de la question...\nRéponse: texte de la réponse courte`}
        className="min-h-28 text-xs font-mono"
      />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={parse} disabled={!raw.trim()}>Analyser</Button>
      </div>
      <p className="text-[10px] text-muted-foreground leading-snug">Délimiteurs supportés: Réponse:, Reponse:, Answer:. Sinon la dernière ligne devient la réponse.</p>
    </div>
  );
}
