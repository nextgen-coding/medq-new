"use client";

import { useState } from 'react';
import { ArrowLeft, Database, Files } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AdminRoute } from '@/components/auth/AdminRoute';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SessionImportPanel } from '@/components/admin/import/SessionImportPanel';
import { QuestionImportPanel } from '@/components/admin/import/QuestionImportPanel';

export default function ImportPage() {
  const [mode, setMode] = useState<'choose' | 'sessions' | 'questions'>('choose');
  return (
    <ProtectedRoute requireAdmin>
      <AdminRoute>
        <AdminLayout>
          {mode === 'choose' && (
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="hover:shadow-lg transition cursor-pointer" onClick={() => setMode('sessions')}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" /> Importer des sessions</CardTitle>
                  <CardDescription>Importer un fichier Excel/CSV de sessions (examens)</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Colonnes: name, pdfUrl, correctionUrl, niveau, semestre, specialty</p>
                </CardContent>
              </Card>
              <Card className="hover:shadow-lg transition cursor-pointer" onClick={() => setMode('questions')}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Files className="h-5 w-5" /> Importer des questions</CardTitle>
                  <CardDescription>Import multi-feuilles (qcm, qroc, cas_qcm, cas_qroc)</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Création automatique des spécialités, cours et cas.</p>
                </CardContent>
              </Card>
            </div>
          )}
          {mode !== 'choose' && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => setMode('choose')}><ArrowLeft className="h-4 w-4 mr-2" /> Retour</Button>
                <h1 className="text-xl font-bold">{mode === 'sessions' ? 'Import des sessions' : 'Import des questions'}</h1>
              </div>
              {mode === 'sessions' ? <SessionImportPanel /> : <QuestionImportPanel />}
            </div>
          )}
        </AdminLayout>
      </AdminRoute>
    </ProtectedRoute>
  );
}