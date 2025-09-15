
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';

interface ParsedResult {
  questionText: string;
  options: { id: string; text: string; explanation?: string }[];
  referenceAnswer?: string;
}
interface AutoParseInputProps {
  questionType: string;
  onParsedContent: (res: ParsedResult) => void;
}

export function AutoParseInput({ onParsedContent, questionType }: AutoParseInputProps) {
  const [rawText, setRawText] = useState('');

  const parseContent = () => {
    if (!rawText.trim()) {
      toast({
        title: "Empty input",
        description: "Please paste a question with answer choices",
        variant: "destructive",
      });
      return;
    }
    try {
      // QROC or clinic_croq parsing (single answer)
      if (questionType === 'qroc' || questionType === 'clinic_croq') {
        // Try to split on common answer delimiters
        const answerDelims = ['Réponse :', 'Réponse:', 'Reponse :', 'Reponse:', 'Answer:', 'Answer :'];
        let referenceAnswer: string | undefined;
        let questionText = rawText.trim();
        for(const delim of answerDelims){
          const idx = rawText.indexOf(delim);
          if(idx !== -1){
            questionText = rawText.slice(0, idx).trim();
            referenceAnswer = rawText.slice(idx + delim.length).trim();
            break;
          }
        }
        if(!referenceAnswer){
          // Attempt newline split heuristic: last line as answer if short
          const lines = rawText.split(/\n+/).map(l=>l.trim()).filter(Boolean);
            if(lines.length>1 && lines[lines.length-1].length <= 120){
              referenceAnswer = lines.pop();
              questionText = lines.join('\n').trim();
            }
        }
        if(!questionText){
          questionText = 'Question non extraite';
        }
        onParsedContent({ questionText, options: [], referenceAnswer });
        toast({ title:'Parsing successful', description: referenceAnswer? 'Question & réponse extraites':'Question extraite (aucune réponse détectée)' });
        return;
      }

        // Unified MCQ parsing with per-option explanations
        const markerRegex = /\n?\s*([A-Ea-e])[\)\.\:]\s+/g;
        const indices: { letter: string; index: number }[] = [];
        let m: RegExpExecArray | null;
        while((m = markerRegex.exec(rawText))){ indices.push({ letter: m[1].toUpperCase(), index: m.index }); }
        if(indices.length < 2){
          toast({ title:'Parsing failed', description:'Need at least two options (A) B) ...).', variant:'destructive'});
          return;
        }
        indices.sort((a,b)=> a.index - b.index);
        const firstIdx = indices[0].index;
        const qText = rawText.slice(0, firstIdx).trim() || 'Question non extraite';
        const segments = indices.map((info, idx)=>{
          const start = info.index;
          const end = idx < indices.length-1 ? indices[idx+1].index : rawText.length;
          const body = rawText.slice(start, end).trim();
          return { body };
        });
        const explanationMarkers = /(Justification|Explication|Explanation|Pourquoi|Raison)\s*[:\-]\s*/i;
        const options = segments.map((seg, i)=>{
          const cleaned = seg.body.replace(/^([A-Ea-e])[\)\.\:]\s+/,'').trim();
          let explanation: string | undefined; let textPart = cleaned;
          const markerMatch = cleaned.match(explanationMarkers);
          if(markerMatch){
            const splitIdx = cleaned.search(explanationMarkers);
            textPart = cleaned.slice(0, splitIdx).trim();
            explanation = cleaned.slice(splitIdx + markerMatch[0].length).trim();
          } else {
            const lines = cleaned.split(/\n+/).map(l=>l.trim()).filter(Boolean);
            if(lines.length>1){ textPart = lines[0]; explanation = lines.slice(1).join('\n').trim(); }
          }
          return { id:String(i+1), text: textPart, explanation };
        });
        const withExplanationCount = options.filter(o=> o.explanation && o.explanation.length>0).length;
        onParsedContent({ questionText: qText, options });
        toast({ title:'Parsing successful', description:`${options.length} options. Explanations: ${withExplanationCount}/${options.length}.` });
  } catch (error) {
      console.error("Parsing error:", error);
      toast({
        title: "Parsing error",
        description: "An error occurred while parsing the content",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-3 p-4 border rounded-md bg-slate-50 dark:bg-muted/30 dark:border-muted/60 backdrop-blur-sm transition-colors">
      <h3 className="text-sm font-medium text-foreground">Auto-Parse ({questionType})</h3>
      <Textarea
        placeholder={questionType==='mcq' || questionType==='clinic_mcq'
          ? 'Collez: énoncé puis A. ..., B) ...\nLigne(s) après une option = explication (Explication:/Justification:/Pourquoi: facultatif).'
          : 'Collez la question puis Réponse: ... ou utilisez la dernière ligne comme réponse courte'}
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        className="min-h-32 font-mono text-sm bg-white dark:bg-background/60 border border-border focus-visible:ring-2 focus-visible:ring-ring"
      />
      { (questionType==='mcq' || questionType==='clinic_mcq') && (
        <p className="text-[10px] text-muted-foreground leading-snug">
          Ajoutez les explications en plaçant une ou plusieurs lignes juste après chaque option. Préfixes reconnus: Explication:, Justification:, Pourquoi:, Raison:. Les lignes jusqu'à la prochaine option sont fusionnées.
        </p>
      )}
      <Button 
        type="button" 
        onClick={parseContent} 
        size="sm"
        className="w-full"
      >
        Parse Question
      </Button>
    </div>
  );
}
