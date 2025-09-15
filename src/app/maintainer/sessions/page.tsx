'use client'

import { useEffect, useState } from 'react';
import { MaintainerRoute } from '@/components/auth/MaintainerRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function MaintainerSessionsPage() {
  const [name, setName] = useState('');
  const [niveauId, setNiveauId] = useState<string>('');
  const [semester, setSemester] = useState<string>('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [correctionUrl, setCorrectionUrl] = useState('');
  const [semesters, setSemesters] = useState<{ id: string; name: string; order: number; niveauId: string }[]>([]);

  useEffect(() => {
    // Fetch semesters for the maintainer's niveau
    const load = async () => {
      try {
        const res = await fetch('/api/semesters');
        if (res.ok) {
          const data = await res.json();
          setSemesters(data);
          if (data[0]?.niveauId) setNiveauId(data[0].niveauId); // implicit from API constraint
        }
      } catch {}
    };
    load();
  }, []);

  const handleCreate = async () => {
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, pdfUrl: pdfUrl || undefined, correctionUrl: correctionUrl || undefined, niveauId: niveauId || undefined, semester: semester || undefined })
      });
      if (!res.ok) {
        let msg = '';
        try { const j = await res.clone().json(); msg = j?.error || j?.message || JSON.stringify(j); } catch { try { msg = await res.text(); } catch {} }
        toast({ title: 'Failed to create session', description: msg || res.statusText, variant: 'destructive' });
        return;
      }
      setName(''); setPdfUrl(''); setCorrectionUrl(''); setSemester('');
      toast({ title: 'Session created', description: name });
    } catch (e) {
      toast({ title: 'Error', description: 'Unexpected error creating session', variant: 'destructive' });
    }
  };

  return (
    <MaintainerRoute>
      <AppLayout>
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Créer une session</CardTitle>
              <CardDescription>Les maintainers peuvent créer des sessions pour leur niveau</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Nom</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label>PDF URL (optionnel)</Label>
                <Input value={pdfUrl} onChange={(e) => setPdfUrl(e.target.value)} />
              </div>
              <div>
                <Label>Correction URL (optionnel)</Label>
                <Input value={correctionUrl} onChange={(e) => setCorrectionUrl(e.target.value)} />
              </div>
              <div>
                <Label>Semestre (optionnel)</Label>
                <Select value={semester || 'none'} onValueChange={(v) => setSemester(v === 'none' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un semestre" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {semesters.map((s) => (
                      <SelectItem key={s.id} value={String(s.order)}>S{s.order}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreate} disabled={!name}>
                <Plus className="h-4 w-4 mr-2" /> Créer
              </Button>
            </CardContent>
          </Card>
        </div>
  </AppLayout>
    </MaintainerRoute>
  );
}
