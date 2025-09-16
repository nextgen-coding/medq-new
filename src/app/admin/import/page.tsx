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
            <div className="space-y-6">
              {/* Pipeline Overview */}
              <div className="bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-lg p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">🔄 Pipeline Validation & Import</h2>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h3 className="font-semibold text-blue-900">1️⃣ Validation (Filter)</h3>
                    <p className="text-sm text-blue-800">
                      <strong>Localisation :</strong> Admin → Validation<br/>
                      <strong>Objectif :</strong> Vérifier rapidement que votre classeur est utilisable, identifier les champs manquants et corriger les lignes avant l'import.
                    </p>
                    <div className="bg-white/60 p-3 rounded border">
                      <p className="text-xs font-medium mb-2">Vérifications automatiques :</p>
                      <ul className="text-xs space-y-1">
                        <li>• Classeur non vide, au moins une feuille reconnue</li>
                        <li>• Colonnes présentes selon le type de feuille</li>
                        <li>• Réponses QCM valides (A–E) ou "?" / "Pas de réponse"</li>
                        <li>• Explications présentes (globale ou par option)</li>
                      </ul>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <h3 className="font-semibold text-green-900">2️⃣ Import (Database)</h3>
                    <p className="text-sm text-green-800">
                      <strong>Localisation :</strong> Admin → Import<br/>
                      <strong>Objectif :</strong> Persister les questions validées dans la base de données (Prisma) et attacher les métadonnées.
                    </p>
                    <div className="bg-white/60 p-3 rounded border">
                      <p className="text-xs font-medium mb-2">Mapping automatique :</p>
                      <ul className="text-xs space-y-1">
                        <li>• Spécialités & cours : créés si non trouvés</li>
                        <li>• Type de question : déduit de la feuille</li>
                        <li>• Options et réponses : parsing intelligent</li>
                        <li>• Déduplication stricte par contenu</li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-sm text-yellow-800">
                    <strong>💡 Conseil :</strong> Si votre classeur est désordonné (format des réponses, explications, espacement), 
                    utilisez d'abord l'<strong>Assistance IA</strong> dans Admin → Validation pour produire un fichier 
                    <code>ai_fixed.xlsx</code> normalisé, puis importez ce fichier corrigé.
                  </p>
                </div>
              </div>

              {/* Import Options */}
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