'use client';
import Image from 'next/image';
import Link from 'next/link';
import { BookOpen, ListChecks, GraduationCap, MessageSquare, BarChart3, Users, Keyboard, Stars } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function GuidePage() {
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
      {/* Navbar (scrolled style) */}
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
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Guide d’utilisation</h1>
          <p className="mt-2 text-medblue-100">Tout ce qu’il faut pour démarrer, s’entraîner et progresser efficacement sur MedQ.</p>
          <p className="mt-1 text-xs md:text-sm text-medblue-200">Dernière mise à jour : 01/09/2025</p>
        </div>
      </section>

      {/* Content */}
      <section className="py-12 md:py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          {/* Sommaire */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm mb-8">
            <h2 className="text-lg font-semibold text-gray-900">Sommaire</h2>
            <div className="mt-3 grid sm:grid-cols-2 gap-2 text-sm">
              {[
                { href: '#demarrer', label: 'Démarrer en 3 étapes' },
                { href: '#premiere-session', label: 'Votre première session' },
                { href: '#question', label: "Interface d’une question" },
                { href: '#reviser', label: 'Réviser efficacement' },
                { href: '#stats', label: 'Statistiques et progression' },
                { href: '#groupes', label: "Groupes d’étude & commentaires" },
                { href: '#parametres', label: 'Paramètres et profil' },
                { href: '#abonnement', label: 'Abonnement & facturation' },
                { href: '#faq', label: 'FAQ rapide' },
                { href: '#aide', label: 'Besoin d’aide ?' },
              ].map(i => (
                <Link key={i.href} href={i.href} className="text-medblue-700 hover:text-medblue-800 underline">{i.label}</Link>
              ))}
            </div>
          </div>

          <div className="prose prose-slate max-w-none">
            <h2 id="demarrer">Démarrer en 3 étapes</h2>
            <ol className="list-decimal pl-6 space-y-1">
              <li><span className="font-medium">Créer un compte</span> ou se connecter depuis la page <Link href="/auth" className="text-medblue-700 underline">d’authentification</Link>.</li>
              <li><span className="font-medium">Compléter le profil</span> (spécialité, niveau) pour une expérience personnalisée.</li>
              <li><span className="font-medium">Lancer une session</span> de QCM ou reprendre vos révisions en un clic.</li>
            </ol>
            <hr className="my-8 md:my-10 border-gray-200" />

            <h2 id="premiere-session">Votre première session</h2>
            <h3>Choisir un mode</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Entraînement</strong> : répondez à votre rythme, avec correction immédiate.</li>
              <li><strong>Examen blanc</strong> : conditions réelles avec chronomètre et score final.</li>
            </ul>
            <h3>Lancer la session</h3>
            <ol className="list-decimal pl-6 space-y-1">
              <li>Depuis le <span className="font-medium">tableau de bord</span>, choisissez une spécialité et un niveau.</li>
              <li>Affinez via les <span className="font-medium">filtres</span> (thème, difficulté) si nécessaire.</li>
              <li>Démarrez et avancez <span className="font-medium">question par question</span>.</li>
            </ol>
            <hr className="my-8 md:my-10 border-gray-200" />

            <h2 id="question">Interface d’une question</h2>
            <p>Chaque question est conçue pour vous aider à progresser rapidement et sereinement.</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Énoncé</strong> clair et contexte clinique.</li>
              <li><strong>Options A–D</strong> cliquables ou au clavier (A/B/C/D, Entrée pour valider).</li>
              <li>Boutons <strong>Valider</strong>, <strong>Suivante</strong> et <strong>Marquer</strong> pour revoir plus tard.</li>
              <li>Après validation : <strong>Correction</strong> détaillée et discussion communautaire.</li>
              <li>Barre de <strong>progression</strong> et navigation précédente/suivante.</li>
            </ul>
            <hr className="my-8 md:my-10 border-gray-200" />

            <h2 id="reviser">Réviser efficacement</h2>
            <h3>Revoir vos erreurs</h3>
            <ol className="list-decimal pl-6 space-y-1">
              <li>Créez une <span className="font-medium">liste d’erreurs</span> basée sur vos derniers résultats.</li>
              <li>Programmez des <span className="font-medium">sessions dédiées</span> pour consolider ces questions.</li>
            </ol>
            <h3>Listes ciblées</h3>
            <p>Filtrez par thème ou difficulté pour travailler précisément vos faiblesses.</p>
            <h3>Favoris & annotations</h3>
            <p>Marquez les items importants et notez votre raisonnement pour y revenir facilement.</p>
            <hr className="my-8 md:my-10 border-gray-200" />

            <h2 id="stats">Statistiques et progression</h2>
            <p>Surveillez l’évolution de vos résultats par spécialité et par thème : taux de réussite, cadence, temps moyen.</p>
            <p>Identifiez vos points faibles et planifiez vos prochaines sessions en conséquence.</p>
            <hr className="my-8 md:my-10 border-gray-200" />

            <h2 id="groupes">Groupes d’étude & commentaires</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Échangez avec la communauté via les <span className="font-medium">commentaires</span> pour clarifier les notions.</li>
              <li>Créez des <span className="font-medium">groupes d’étude</span>, synchronisez des sessions et comparez vos résultats.</li>
            </ul>
            <hr className="my-8 md:my-10 border-gray-200" />

            <h2 id="parametres">Paramètres et profil</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Spécialité, niveau et préférences de sessions.</li>
              <li>Notifications e‑mail et confidentialité.</li>
              <li>Informations de compte (nom, e‑mail, mot de passe).</li>
            </ul>
            <hr className="my-8 md:my-10 border-gray-200" />

            <h2 id="abonnement">Abonnement & facturation</h2>
            <ol className="list-decimal pl-6 space-y-1">
              <li>Gérez le <span className="font-medium">renouvellement</span> et accédez à vos <span className="font-medium">factures</span> depuis votre compte.</li>
              <li>Annulez à tout moment ; l’accès reste actif jusqu’à la fin de la période.</li>
            </ol>
            <hr className="my-8 md:my-10 border-gray-200" />

            <h2 id="faq">FAQ rapide</h2>
            <h3>Puis‑je changer de spécialité ?</h3>
            <p>Oui, à tout moment dans les paramètres de votre profil.</p>
            <h3>Comment récupérer mon mot de passe ?</h3>
            <p>Utilisez « Mot de passe oublié » sur la page d’authentification pour recevoir un e‑mail de réinitialisation.</p>
            <h3>Les questions sont‑elles mises à jour ?</h3>
            <p>La base est améliorée en continu grâce aux retours de la communauté et à nos mises à jour régulières.</p>
            <hr className="my-8 md:my-10 border-gray-200" />

            <h2 id="aide">Besoin d’aide ?</h2>
            <p>Consultez la <Link href="/faq" className="text-medblue-700 underline">FAQ</Link> ou contactez‑nous : <a href="mailto:contact@medq.tn" className="text-medblue-700 underline">contact@medq.tn</a>.</p>
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
