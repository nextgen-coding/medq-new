'use client';
import Image from 'next/image';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function PrivacyPage() {
  const openCrispChat = () => {
    try {
      if (!(window as any).$crisp) {
        window.location.href = 'mailto:contact@medq.tn';
        return;
      }
      (window as any).$crisp.push(["do","chat:show"]);
      (window as any).$crisp.push(["do","chat:open"]);
    } catch {}
  };
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
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Politique de confidentialité</h1>
          <p className="mt-2 text-medblue-100">Comment nous collectons, utilisons et protégeons vos données sur MedQ.</p>
          <p className="mt-1 text-xs md:text-sm text-medblue-200">Dernière mise à jour : 01/09/2025</p>
        </div>
      </section>

      {/* Content */}
      <section className="py-12 md:py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-12">
          {/* Section 1 */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-8 md:p-10">
            <h2 id="donnees-collectees" className="text-3xl font-bold text-gray-900 mb-8 flex items-center gap-4">
              <span className="w-12 h-12 bg-medblue-100 text-medblue-600 rounded-xl flex items-center justify-center text-xl font-bold">1</span>
              Données collectées
            </h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-4">Compte & profil</h3>
                <ul className="space-y-3 text-gray-700">
                  <li className="flex items-start gap-3"><span className="w-2 h-2 bg-medblue-500 rounded-full mt-3" /><span className="text-lg">Nom, e‑mail, spécialité, niveau.</span></li>
                  <li className="flex items-start gap-3"><span className="w-2 h-2 bg-medblue-500 rounded-full mt-3" /><span className="text-lg">Préférences d’étude (modes, filtres).</span></li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-4">Activité pédagogique</h3>
                <ul className="space-y-3 text-gray-700">
                  <li className="flex items-start gap-3"><span className="w-2 h-2 bg-medblue-500 rounded-full mt-3" /><span className="text-lg">Progression, réponses, annotations, favoris.</span></li>
                  <li className="flex items-start gap-3"><span className="w-2 h-2 bg-medblue-500 rounded-full mt-3" /><span className="text-lg">Interactions sociales (commentaires, réactions).</span></li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-4">Données techniques</h3>
                <ul className="space-y-3 text-gray-700">
                  <li className="flex items-start gap-3"><span className="w-2 h-2 bg-medblue-500 rounded-full mt-3" /><span className="text-lg">Identifiants de session, type d'appareil.</span></li>
                  <li className="flex items-start gap-3"><span className="w-2 h-2 bg-medblue-500 rounded-full mt-3" /><span className="text-lg">Logs techniques (performance, erreurs).</span></li>
                </ul>
              </div>
            </div>
          </div>

          {/* Section 2 */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-8 md:p-10">
            <h2 id="finalites" className="text-3xl font-bold text-gray-900 mb-8 flex items-center gap-4">
              <span className="w-12 h-12 bg-medblue-100 text-medblue-600 rounded-xl flex items-center justify-center text-xl font-bold">2</span>
              Finalités du traitement
            </h2>
            <div className="space-y-10">
              <div className="border-l-4 border-medblue-200 pl-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Fournir et améliorer le service</h3>
                <ul className="space-y-3 text-gray-700">
                  <li className="flex items-start gap-3"><span className="w-2 h-2 bg-medblue-500 rounded-full mt-3" /><span className="text-lg">Fonctionnalités d'apprentissage (statistiques, sessions, commentaires).</span></li>
                  <li className="flex items-start gap-3"><span className="w-2 h-2 bg-medblue-500 rounded-full mt-3" /><span className="text-lg">Personnalisation selon spécialité et niveau.</span></li>
                </ul>
              </div>
              <div className="border-l-4 border-medblue-200 pl-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Sécurité et intégrité</h3>
                <p className="text-lg text-gray-700">Prévenir la fraude, garantir la disponibilité et la confidentialité.</p>
              </div>
              <div className="border-l-4 border-medblue-200 pl-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Assistance & communication</h3>
                <p className="text-lg text-gray-700">Support utilisateur et informations importantes.</p>
              </div>
            </div>
          </div>

          {/* Section 3 */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-8 md:p-10">
            <h2 id="partage" className="text-3xl font-bold text-gray-900 mb-8 flex items-center gap-4">
              <span className="w-12 h-12 bg-medblue-100 text-medblue-600 rounded-xl flex items-center justify-center text-xl font-bold">3</span>
              Partage & sous-traitance
            </h2>
            <p className="text-lg text-gray-700 leading-relaxed">Aucun usage commercial externe. Partage limité à des prestataires techniques (hébergement, email, analytics internes) sous engagement contractuel.</p>
          </div>

          {/* Section 4 */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-8 md:p-10">
            <h2 id="securite" className="text-3xl font-bold text-gray-900 mb-8 flex items-center gap-4">
              <span className="w-12 h-12 bg-medblue-100 text-medblue-600 rounded-xl flex items-center justify-center text-xl font-bold">4</span>
              Sécurité
            </h2>
            <p className="text-lg text-gray-700 leading-relaxed">Chiffrement en transit (HTTPS), contrôles d’accès, surveillance et limitation d’accès interne. Aucun système n’est infaillible – protégez vos identifiants.</p>
          </div>

          {/* Section 5 */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-8 md:p-10">
            <h2 id="duree" className="text-3xl font-bold text-gray-900 mb-8 flex items-center gap-4">
              <span className="w-12 h-12 bg-medblue-100 text-medblue-600 rounded-xl flex items-center justify-center text-xl font-bold">5</span>
              Durée de conservation
            </h2>
            <p className="text-lg text-gray-700 leading-relaxed">Les données liées au compte sont conservées tant que le compte est actif. En cas de suppression, certaines informations techniques ou légales peuvent être conservées pour conformité.</p>
          </div>

          {/* Section 6 */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-8 md:p-10">
            <h2 id="vos-droits" className="text-3xl font-bold text-gray-900 mb-8 flex items-center gap-4">
              <span className="w-12 h-12 bg-medblue-100 text-medblue-600 rounded-xl flex items-center justify-center text-xl font-bold">6</span>
              Vos droits
            </h2>
            <ul className="space-y-4 text-gray-700 mb-6">
              <li className="flex items-start gap-3"><span className="w-2 h-2 bg-medblue-500 rounded-full mt-3" /><span className="text-lg">Accès, rectification, portabilité, limitation et suppression.</span></li>
              <li className="flex items-start gap-3"><span className="w-2 h-2 bg-medblue-500 rounded-full mt-3" /><span className="text-lg">Opposition aux traitements non essentiels (ex : analytics avancés).</span></li>
            </ul>
          </div>

          {/* Section 7 */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-8 md:p-10">
            <h2 id="contact" className="text-3xl font-bold text-gray-900 mb-8 flex items-center gap-4">
              <span className="w-12 h-12 bg-medblue-100 text-medblue-600 rounded-xl flex items-center justify-center text-xl font-bold">7</span>
              Contact
            </h2>
            <p className="text-lg text-gray-700 leading-relaxed mb-6">Pour toute demande relative à la vie privée :</p>
            <div className="p-6 bg-medblue-50 rounded-xl border border-medblue-100">
              <a href="mailto:contact@medq.tn" className="text-xl font-semibold text-medblue-700 hover:text-medblue-800 transition-colors">contact@medq.tn</a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer (same as landing) */}
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
