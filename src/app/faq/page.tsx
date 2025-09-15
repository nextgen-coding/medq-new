'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { ForceLightTheme } from '@/components/ForceLightTheme';

const faqs: { q: string; a: string }[] = [
  {
    q: 'Qu\u2019est-ce que MedQ ?',
    a: 'Une plateforme d\u2019apprentissage dédiée aux étudiants en médecine avec QCM, cours interactifs et suivi de performance.'
  },
  {
    q: 'Quand la plateforme sera-t-elle disponible ?',
    a: 'Bientôt. Vous serez notifié par e-mail lors de l\u2019ouverture officielle.'
  },
  {
    q: 'Puis-je contribuer ou signaler un problème ?',
    a: 'Oui, contactez-nous via nos canaux officiels; des fonctionnalités communautaires arrivent.'
  }
];

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-white text-slate-800">
      <ForceLightTheme />
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900">
            <ChevronLeft className="w-4 h-4 mr-1" /> Retour
          </Link>
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight mb-6">FAQ</h1>
        <p className="text-slate-600 mb-10 max-w-2xl">Questions fréquentes sur MedQ. Cette page est une première version et sera enrichie.</p>
        <div className="space-y-6">
          {faqs.map((item, i) => (
            <div key={i} className="border border-slate-200 rounded-lg p-5 bg-slate-50/60">
              <h2 className="font-semibold text-slate-900 text-lg mb-2">{item.q}</h2>
              <p className="text-slate-600 leading-relaxed text-sm">{item.a}</p>
            </div>
          ))}
        </div>
      </div>
      <footer className="border-t mt-16 py-8 text-center text-xs text-slate-500 bg-slate-50/60">
        <p>MedQ &copy; {new Date().getFullYear()} - Tous droits réservés.</p>
      </footer>
    </div>
  );
}
