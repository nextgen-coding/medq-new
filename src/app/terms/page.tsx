'use client';
import Image from 'next/image';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="fixed w-full top-0 z-50 bg-white/95 backdrop-blur-md shadow-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14 md:h-16">
            <Link href="/" aria-label="Aller à l'accueil" className="flex items-center">
              <Image src="https://hbc9duawsb.ufs.sh/f/0SaNNFzuRrLwc6JmYDs7xU9KRorsOPBFM3XfQgEkDm2yuiLj" alt="MedQ logo" width={200} height={48} sizes="200px" priority className="h-10 md:h-12 w-auto object-contain drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]" />
            </Link>
            <div className="flex space-x-3 md:space-x-4">
              <Link href="/auth?mode=login" className="border border-medblue-600 text-medblue-600 hover:bg-medblue-50 hover:border-medblue-700 hover:text-medblue-700 hover:shadow-md hover:-translate-y-0.5 bg-transparent text-sm md:text-base px-3 md:px-4 py-1.5 md:py-2 rounded-lg transition-all duration-200">Connexion</Link>
              <Link href="/auth" className="bg-medblue-600 hover:bg-medblue-700 text-white shadow-lg transform hover:scale-105 transition-all duration-200 px-4 py-2 rounded-lg">Commencer</Link>
            </div>
          </div>
        </div>
      </nav>
      {/* Spacer */}
      <div className="h-14 md:h-16" />

      {/* Hero */}
      <section className="bg-gradient-to-br from-medblue-600 to-medblue-800 py-12 md:py-16 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="mb-3">
            <Link href="/" className="inline-flex items-center gap-2 text-medblue-100 hover:text-white transition-colors">
              <span className="text-lg">←</span>
              <span className="text-sm font-medium">Retour à l'accueil</span>
            </Link>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Conditions d'utilisation</h1>
          <p className="mt-2 text-medblue-100">Règles encadrant l’accès et l’usage de la plateforme MedQ.</p>
          <p className="mt-1 text-xs md:text-sm text-medblue-200">Dernière mise à jour : 01/09/2025</p>
        </div>
      </section>

      {/* Content */}
      <section className="py-12 md:py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-10">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-8 md:p-10">
            <h2 id="objet" className="text-2xl font-bold mb-4">1. Objet</h2>
            <p className="text-gray-700 leading-relaxed">Ces conditions régissent l’accès et l’utilisation de MedQ (questions, corrections, annotations, statistiques et outils collaboratifs).</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-8 md:p-10">
            <h2 id="compte" className="text-2xl font-bold mb-4">2. Compte et sécurité</h2>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>Identifiants personnels, confidentiels et non transférables.</li>
              <li>Signalez tout accès non autorisé.</li>
              <li>Suppression possible en cas d’abus manifeste.</li>
            </ul>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-8 md:p-10">
            <h2 id="usage" className="text-2xl font-bold mb-4">3. Usage autorisé</h2>
            <p className="text-gray-700 leading-relaxed">Utilisation individuelle pour apprentissage. Interdits : extraction massive, republication systématique, utilisation concurrente.</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-8 md:p-10">
            <h2 id="contenu" className="text-2xl font-bold mb-4">4. Contenu utilisateur</h2>
            <p className="text-gray-700 leading-relaxed">Vous conservez vos droits sur vos notes et commentaires. Vous nous accordez une licence limitée pour les afficher et améliorer la plateforme.</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-8 md:p-10">
            <h2 id="resiliation" className="text-2xl font-bold mb-4">5. Suspension & résiliation</h2>
            <p className="text-gray-700 leading-relaxed">Nous pouvons suspendre ou résilier un compte en cas de fraude, tentative d’attaque ou violation répétée.</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-8 md:p-10">
            <h2 id="limitation" className="text-2xl font-bold mb-4">6. Limitation de responsabilité</h2>
            <p className="text-gray-700 leading-relaxed">Service fourni « tel quel ». Aucune garantie de réussite aux examens; exclusion des dommages indirects.</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-8 md:p-10">
            <h2 id="contact" className="text-2xl font-bold mb-4">7. Contact</h2>
            <p className="text-gray-700 leading-relaxed">Pour toute question : <a href="mailto:legal@medq.tn" className="text-medblue-700 underline">legal@medq.tn</a>.</p>
            <p className="text-sm text-gray-500 mt-4">En cas de divergence, les informations affichées dans l’application prévalent.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gradient-to-br from-gray-800 to-gray-900 text-white py-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div>
              <Image src="https://hbc9duawsb.ufs.sh/f/0SaNNFzuRrLwEhDtvz72VxFcMaBkoOH8vYK05Zd6q4mGPySp" alt="MedQ logo" width={200} height={48} sizes="200px" className="h-10 md:h-12 w-auto object-contain mb-4" />
              <p className="text-gray-300 leading-relaxed">La plateforme d'apprentissage médical de référence pour les étudiants ambitieux.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-white">Plateforme</h4>
              <ul className="space-y-2 text-gray-300">
                <li><Link href="/" className="hover:text-medblue-300 transition-colors">Accueil</Link></li>
                <li><Link href="/#fonctionnalites" className="hover:text-medblue-300 transition-colors">Fonctionnalités</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-white">Ressources</h4>
              <ul className="space-y-2 text-gray-300">
                <li><Link href="/guide" className="hover:text-medblue-300 transition-colors">Guide d'utilisation</Link></li>
                <li><Link href="/faq" className="hover:text-medblue-300 transition-colors">FAQ</Link></li>
                <li><Link href="/privacy" className="hover:text-medblue-300 transition-colors">Politique de confidentialité</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-white">Nous contacter</h4>
              <p className="text-gray-300">contact@medq.tn</p>
            </div>
          </div>
          <div className="border-t border-gray-700 pt-8 text-center">
            <p className="text-gray-400">© 2025 MedQ. Tous droits réservés. | <Link href="/privacy" className="hover:text-medblue-300 ml-1">Politique de confidentialité</Link> | <Link href="/terms" className="hover:text-medblue-300 ml-1">Conditions d'utilisation</Link></p>
          </div>
        </div>
      </footer>
    </main>
  );
}
