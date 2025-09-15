'use client'

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AOS from 'aos';
import 'aos/dist/aos.css';
import { 
  CheckCircle, 
  BarChart3, 
  Users, 
  Star, 
  Filter,
  PieChart,
  Highlighter,
  Moon,
  ChevronDown,
  Facebook,
  Instagram,
  MessageCircle,
  Mail,
  ArrowRight,
  Play,
  Brain,
  Shield,
  Zap,
  Target,
  Clock,
  Smartphone,
  Tablet,
  Quote,
  RefreshCcw,
  CircleHelp,
  Sparkles
} from 'lucide-react';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Disable static generation to prevent SSR issues with useAuth
export const dynamic = 'force-dynamic';

export default function HomePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('Accueil');
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isScrolledRef = useRef(false);
  useEffect(() => { isScrolledRef.current = isScrolled; }, [isScrolled]);

  // Redirect authenticated users to appropriate page
  useEffect(() => {
    if (!isLoading && user) {
      if (user.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    // rAF-throttled navbar scroll handling with hysteresis to avoid flicker near top
    let ticking = false;
    const thresholdOn = 80;   // turn on scrolled state when passing this
    const thresholdOff = 30;  // turn off when going back above this

    const onNavScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const current = isScrolledRef.current;
        const next = current ? (y > thresholdOff) : (y > thresholdOn);
        if (next !== current) {
          isScrolledRef.current = next;
          setIsScrolled(next);
        }
        ticking = false;
      });
    };

    window.addEventListener('scroll', onNavScroll, { passive: true });
    // Initial state
    onNavScroll();
    return () => window.removeEventListener('scroll', onNavScroll);
  }, []);

  // Update active nav item while scrolling based on visible section
  useEffect(() => {
    const sectionIds = ['accueil','caracteristiques','fonctionnalites','faq'];
    const options: IntersectionObserverInit = {
      root: null,
      rootMargin: '-20% 0px -70% 0px', // Better detection zone
      threshold: [0, 0.1, 0.5, 1.0] // Multiple thresholds for better accuracy
    };
    const idToTab: Record<string,string> = {
      'accueil': 'Accueil',
      'caracteristiques': 'Caractéristiques',
      'fonctionnalites': 'Fonctionnalités',
      'faq': 'FAQ'
    };
    
    let observer: IntersectionObserver | null = null;

    // Scroll handler for active tab detection (throttled with rAF)
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const scrollY = window.scrollY;

        // If we're at the very top, set active to Accueil
        if (scrollY < 100) {
          if (activeTab !== 'Accueil') {
            setActiveTab('Accueil');
          }
          ticking = false;
          return;
        }

        // Check which section is most visible
        const sections = sectionIds.slice(1).map(id => { // Skip accueil as it's handled above
          const element = document.getElementById(id);
          if (!element) return null;

          const rect = element.getBoundingClientRect();
          const viewportHeight = window.innerHeight;

          // Calculate how much of the section is visible
          const visibleTop = Math.max(0, -rect.top);
          const visibleBottom = Math.min(rect.height, viewportHeight - rect.top);
          const visibleHeight = Math.max(0, visibleBottom - visibleTop);
          const visibilityRatio = visibleHeight / viewportHeight;

          return {
            id,
            element,
            visibilityRatio,
            distanceFromCenter: Math.abs(rect.top + rect.height / 2 - viewportHeight / 2)
          };
        }).filter(Boolean);

        if (sections.length > 0) {
          // Find the section that's most prominently visible
          const mostVisible = sections.reduce((prev, current) => {
            if (!current) return prev; // type safety
            if (!prev) return current;
            // Prioritize sections that are more visible and closer to center
            const prevScore = prev.visibilityRatio - (prev.distanceFromCenter / 1000);
            const currentScore = current.visibilityRatio - (current.distanceFromCenter / 1000);
            return currentScore > prevScore ? current : prev;
          }, null as typeof sections[number] | null);

          if (mostVisible && mostVisible.visibilityRatio > 0.1) { // At least 10% visible
            const newTab = idToTab[mostVisible.id];
            if (newTab && newTab !== activeTab) {
              setActiveTab(newTab);
            }
          }
        }
        ticking = false;
      });
    };
    
    try {
      // Intersection Observer as backup
      observer = new IntersectionObserver((entries) => {
        // Only use this if we're not at the top
        if (window.scrollY > 100) {
          const visible = entries
            .filter(e => e.isIntersecting && e.intersectionRatio > 0.1)
            .sort((a,b) => b.intersectionRatio - a.intersectionRatio);
          
          if (visible.length > 0) {
            const id = visible[0].target.id;
            if (idToTab[id] && idToTab[id] !== activeTab) {
              setActiveTab(idToTab[id]);
            }
          }
        }
      }, options);
      
      sectionIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) observer!.observe(el);
      });
      
  // Add scroll listener
  window.addEventListener('scroll', onScroll, { passive: true });

  // Initial check
  onScroll();
      
    } catch (e) {
      // fail silently if IntersectionObserver not available
      console.warn('IntersectionObserver init failed', e);
    }
    
    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, [activeTab]);

  // Initialize AOS
  useEffect(() => {
    AOS.init({
      duration: 800,
      easing: 'ease-out-cubic',
      once: true,
      offset: 100,
    });
  }, []);

  // Don't render anything while loading or if user is authenticated
  if (isLoading || user) {
    return null;
  }

  const scrollToSection = (sectionId: string) => {
  // Close mobile menu on navigation
  if (mobileOpen) setMobileOpen(false);
    if (sectionId === 'accueil') {
      // Scroll to the very top of the page
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setActiveTab('Accueil');
      return;
    }
    
    const element = document.getElementById(sectionId);
    if (element) {
      // Calculate offset to account for fixed navbar
  const nav = document.querySelector('nav') as HTMLElement | null;
  const navHeight = (nav?.offsetHeight ?? 64); // Measure actual navbar height
      const elementTop = element.getBoundingClientRect().top + window.pageYOffset;
      const offsetTop = elementTop - navHeight;
      
      window.scrollTo({ 
        top: offsetTop, 
        behavior: 'smooth' 
      });
      
      const sectionTabMap: Record<string, string> = {
        'accueil': 'Accueil',
        'caracteristiques': 'Caractéristiques', 
        'fonctionnalites': 'Fonctionnalités',
        'faq': 'FAQ'
      };
      
      if (sectionTabMap[sectionId]) {
        // Set active tab immediately for better UX
        setActiveTab(sectionTabMap[sectionId]);
      }
    }
  };

  const characteristics = [
  { icon: <Highlighter className="w-8 h-8 text-medblue-500" />, title: 'Apprentissage actif', description: 'Surlignez, prenez des notes, épinglez vos questions importantes : un espace d’étude 100% personnalisé.' },
  { icon: <BarChart3 className="w-8 h-8 text-medblue-600" />, title: 'Analyse de progression', description: 'Statistiques détaillées pour visualiser vos forces et cibler précisément vos points faibles.' },
    { icon: <Users className="w-8 h-8 text-medblue-500" />, title: 'Apprentissage collaboratif', description: 'Commentez chaque question ou cours, partagez vos astuces, révisez ensemble.' },
  { icon: <RefreshCcw className="w-8 h-8 text-medblue-600" />, title: 'Mises à jour continues', description: 'Plateforme interactive enrichie et ajustée régulièrement.' },
    { icon: <Clock className="w-8 h-8 text-medblue-500" />, title: 'Accessibilité totale', description: 'Étudiez à votre rythme, où que vous soyez, accès 24h/24.' },
  { icon: <Shield className="w-8 h-8 text-medblue-600" />, title: 'Simplicité & sécurité', description: 'Paiement simple (en ligne, virement, espèces) et données protégées.' }
  ];

  const features = [
    { 
      title: 'Statistiques détaillées', 
      description: 'Vue d’ensemble de vos performances + suivi par spécialité et question.', 
  icon: <PieChart className="w-12 h-12 text-medblue-600" />,
      screenshots: ['/screenshot-dashboard.png', '/screenshot-course.png'],
      alt: 'Dashboard & page de cours'
    },
    { 
      title: 'Commentaire', 
      description: 'Discutez chaque question ou cours avec la communauté.', 
  icon: <MessageCircle className="w-12 h-12 text-medblue-600" />,
      screenshots: ['/screenshot-comments.png'],
      alt: 'Commentaires'
    },
    { 
      title: 'Préparez vos sessions', 
      description: 'Organisation ciblée pour aborder les sessions plus facilement.', 
      icon: <Target className="w-12 h-12 text-medblue-600" />,
      // NOTE: png manquant dans public (seulement .svg). Mettre le bon fichier png ou laisser svg provisoire.
      screenshots: ['/screenshot-sessions.png'],
      alt: 'Préparation des sessions'
    },
    { 
      title: 'Prise de note, surligner & épingler', 
      description: 'Annotations personnelles pour mémorisation active.', 
  icon: <Highlighter className="w-12 h-12 text-medblue-600" />,
      screenshots: ['/screenshot-annotations.png'],
      alt: 'Annotations et notes'
    },
    { 
      title: 'Réviser efficacement à ton rythme', 
      description: 'Filtres puissants + Study modes pour un apprentissage flexible.', 
      icon: <Brain className="w-12 h-12 text-medblue-600" />,
      screenshots: ['/screenshot-filters.png', '/screenshot-study-modes.png'],
      alt: 'Filtres et modes d\'étude'
    }
  ];

  // Pricing section removed

  const testimonials = [
    {
      name: 'Yasmine boukhari',
      level: 'DCEM 3',
      photo: 'https://r5p6ptp1nn.ufs.sh/f/6mc1qMI9JcraIWGOSpBzuVb1qCtByPHoX8MTN0ipchnGfajs',
      text:
        'Grand bravo à toute l’équipe 👏 un travail très prometteur et sérieux qui m’a bcp aidée : un accès simple, des questions mises à jour à partir des sessions les plus récentes, des réponses fiables avec des explications pertinentes inspirées surtout des polycopiés .. un vrai gain en temps et en efficacité. Bonne continuation ❤️'
    },
    {
      name: 'Seif ben rhaiem',
      level: 'DCEM 1',
      photo: 'https://r5p6ptp1nn.ufs.sh/f/6mc1qMI9JcraVnZrO56dcSkDYHbavhq9oRU2TzF4xPGjZ0Lm',
      text:
        'MedQ a complètement changé ma façon de réviser. Grâce au surlignement, je peux rapidement repérer les points importants dans chaque QCM. La prise de notes intégrée me permet d’ajouter mes propres explications ou rappels directement à côté de chaque question. C’est comme si j’avais mon cahier de révision personnalisé, mais en version numérique, toujours accessible.'
    },
    {
      name: 'Firas Farhati',
      level: 'DCEM 3',
      photo: 'https://r5p6ptp1nn.ufs.sh/f/6mc1qMI9Jcra2faTfH9dlRw6nuJtVSZc9v4hPByCF7ITg1pD',
      text:
        "J'ai eu l'honneur d'être parmi les premiers à utiliser la version 0 de MedQ. Ce que j’aime le plus avec MedQ, c’est que je n’ai plus à me soucier de l’endroit où je révise. Que je sois sur mon ordinateur à la maison, sur ma tablette à la bibliothèque ou sur mon téléphone dans le bus, j’ai toujours accès à mes exercices et à ma progression. MedQ est vraiment disponible partout, et ça change tout pour mes révisions."
    }
  ];

  const faqItems = [
    {
      question: 'Quels sont les modes de paiement acceptés ?',
      answer:
        'Vous pouvez payer par carte bancaire, D17, virement ou en espèces via un code de paiement. Tous les moyens sont simples et 100% sécurisés.'
    },
    {
      question: 'Puis-je utiliser MedQ sur plusieurs appareils ?',
      answer:
        'Oui, votre compte fonctionne sur ordinateur, tablette et mobile. Tout est synchronisé automatiquement pour garder vos notes et stats à jour.'
    },
    {
      question: 'Le contenu est-il régulièrement mis à jour ?',
      answer:
        'Oui, nous publions de nouvelles questions, corrections et explications détaillées tout au long de l’année. Vous révisez toujours avec la version la plus récente.'
    },
    {
      question: 'Quelle est votre politique tarifaire et rapport qualité/prix ?',
      answer:
        'Notre abonnement est moins cher qu’un support papier et offre bien plus de fonctionnalités. Nous garantissons le meilleur rapport qualité/prix pour vos révisions.'
    },
    {
      question: 'Y a-t-il une période d’essai gratuite ?',
      answer:
        'Oui, vous pouvez accéder à plusieurs cours et questions gratuitement. Cela vous permet de tester MedQ avant de vous abonner.'
    },
    {
      question: 'Comment activer mon abonnement via un code de paiement ?',
      answer:
        'Après paiement, vous recevez un code unique. Il suffit de l’entrer dans la section Abonnement de votre profil pour activer l’accès immédiatement.'
    }
  ];

  const toggleFAQ = (index: number) => {
    setOpenFAQ(openFAQ === index ? null : index);
  };

  // Ensure wheel scrolling is never blocked in the hero section
  const handleHeroWheel = (e: React.WheelEvent) => {
    // Forward the wheel delta to window scroll and prevent default to avoid double scrolling
    e.preventDefault();
    if (e.deltaY !== 0) {
      window.scrollBy({ top: e.deltaY, left: 0, behavior: 'auto' });
    }
  };

  // Open Crisp chat helper with graceful fallback
  const openCrispChat = () => {
    try {
      // If Crisp isn’t configured (e.g., missing env), fallback to contact page
      if (!process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID) {
        router.push('/contact');
        return;
      }
      const w = window as any;
      w.$crisp = w.$crisp || [];
      // Ensure widget is visible and open
      w.$crisp.push(["do", "chat:show"]);
      w.$crisp.push(["do", "chat:open"]);
    } catch (e) {
      // Last‑resort fallback
      router.push('/contact');
    }
  };

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* Custom Animations */}
      <style jsx global>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        
        .animate-fade-in {
          animation: fade-in 1s ease-out;
        }
        
        .animate-slide-up {
          animation: slide-up 1s ease-out;
        }
        
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        
        /* Remove previous global white-forcing overrides */
      `}</style>

  {/* Navigation */}
      <nav className={`fixed w-full top-0 z-50 transition-all duration-300 ${
         isScrolled 
           ? 'bg-white/95 backdrop-blur-md shadow-lg border-b border-gray-200' 
           : 'bg-transparent'
       }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14 md:h-16">
            <div className="flex items-center">
              <button
                onClick={() => scrollToSection('accueil')}
                className="flex items-center focus:outline-none"
                aria-label="Aller à l'accueil"
              >
                <div className="relative" style={{ width: 200, height: 48 }}>
                  {/* Dark logo (default) */}
                  <Image
                    src="https://hbc9duawsb.ufs.sh/f/0SaNNFzuRrLwEhDtvz72VxFcMaBkoOH8vYK05Zd6q4mGPySp"
                    alt="MedQ logo"
                    width={200}
                    height={48}
                    sizes="200px"
                    priority
                    className={`h-10 md:h-12 w-auto object-contain transition-opacity duration-300 ${isScrolled ? 'opacity-0' : 'opacity-100 drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]'}`}
                  />
                  {/* White logo (on scroll) */}
                  <Image
                    src="https://hbc9duawsb.ufs.sh/f/0SaNNFzuRrLwc6JmYDs7xU9KRorsOPBFM3XfQgEkDm2yuiLj"
                    alt="MedQ logo"
                    width={200}
                    height={48}
                    sizes="200px"
                    priority
                    className={`absolute top-0 left-0 h-10 md:h-12 w-auto object-contain transition-opacity duration-300 ${isScrolled ? 'opacity-100 drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]' : 'opacity-0'}`}
                  />
                </div>
              </button>
            </div>
             <div className="hidden lg:flex space-x-8">
               {[
                 { name: 'Accueil', id: 'accueil' },
                 { name: 'Caractéristiques', id: 'caracteristiques' },
                 { name: 'Fonctionnalités', id: 'fonctionnalites' },
                 { name: 'FAQ', id: 'faq' }
               ].map((item) => (
                 <button
                   key={item.name}
                   onClick={() => scrollToSection(item.id)}
                   className={`px-4 py-2 font-medium transition-all duration-200 relative ${
                     activeTab === item.name
                       ? isScrolled 
                         ? 'text-medblue-600 border-b-2 border-medblue-600' 
                         : 'text-white border-b-2 border-white'
                       : isScrolled
                         ? 'text-gray-900 hover:text-medblue-600'
                         : 'text-white/80 hover:text-white'
                   }`}
                 >
                   {item.name}
                 </button>
               ))}
             </div>
            {/* Desktop CTA */}
            <div className="hidden lg:flex">
              <Button
                onClick={() => router.push('/auth')}
                className="bg-medblue-600 hover:bg-medblue-700 text-white shadow-lg transform hover:scale-105 transition-all duration-200"
              >
                Commencer
              </Button>
            </div>

            {/* Mobile hamburger */}
            <div className="lg:hidden flex items-center">
              <button
                type="button"
                aria-label="Ouvrir le menu"
                aria-expanded={mobileOpen}
                onClick={() => setMobileOpen((v) => !v)}
                className={`inline-flex items-center justify-center rounded-md p-2 transition-colors ${
                  isScrolled ? 'text-gray-900 hover:bg-gray-100' : 'text-white hover:bg-white/10'
                }`}
              >
                {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
           </div>
         </div>
       </nav>

      {/* Mobile menu overlay and panel */}
  {mobileOpen && (
        <>
          <div
    className="lg:hidden fixed inset-0 top-14 md:top-16 bg-black/30 z-40"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
      <div className="lg:hidden fixed top-14 md:top-16 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-xl">
            <div className="px-4 py-3 divide-y divide-gray-100">
              <div className="flex flex-col py-2">
                {[
                  { name: 'Accueil', id: 'accueil' },
                  { name: 'Caractéristiques', id: 'caracteristiques' },
                  { name: 'Fonctionnalités', id: 'fonctionnalites' },
                  { name: 'FAQ', id: 'faq' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className="text-left px-3 py-3 rounded-lg text-gray-900 hover:bg-medblue-50 hover:text-medblue-700"
                  >
                    {item.name}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-2 py-3">
                <Button
                  onClick={() => { setMobileOpen(false); router.push('/auth'); }}
                  className="w-full bg-medblue-600 hover:bg-medblue-700 text-white"
                >
                  Commencer
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

       {/* Hero Section */}
  <section id="accueil" className="relative min-h-screen flex items-center justify-center overflow-hidden touch-pan-y" onWheel={handleHeroWheel}>
         <div className="absolute inset-0 bg-gradient-to-br from-medblue-700 via-medblue-800 to-medblue-900 pointer-events-none"></div>        {/* ONE BIG DRAMATIC CURVE */}
        <div className="absolute bottom-0 left-0 w-full overflow-hidden z-20 pointer-events-none">
          <svg
            className="relative block w-full h-40 md:h-48 lg:h-56"
            viewBox="0 0 1200 400"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="waveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="1"/>
                <stop offset="100%" stopColor="#ffffff" stopOpacity="1"/>
              </linearGradient>
            </defs>
            <path
              d="M0,200 C300,120 400,280 600,160 C800,80 900,220 1200,140 L1200,400 L0,400 Z"
              fill="url(#waveGradient)"
            />
          </svg>
        </div>
        
  <div className="absolute inset-0 bg-black/10 z-0 pointer-events-none"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-10 md:py-12 lg:py-14 z-10">
          <div className="grid items-center gap-6 md:gap-8 lg:gap-12 md:grid-cols-2 lg:[grid-template-columns:1.25fr_0.75fr]">
             <div className="text-white space-y-8">
               <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight tracking-tight animate-fade-in max-w-none">
                 <span className="mr-1">MedQ,</span>
                 <span className="align-baseline text-[0.8em] md:text-[0.8em] lg:text-[0.82em]  font-medium">1ère plateforme pensée pour les externes en médecine</span>
               </h1>
               <p className="text-base md:text-lg lg:text-xl text-white/90 animate-slide-up font-semibold tracking-wide">
                 Révisez • Progressez • Réussissez
               </p>
               <p className="text-slate-200  text-sm md:text-base opacity-90 leading-relaxed animate-slide-up max-w-2xl" style={{ animationDelay: '0.2s' }}>
                 Facilitez vos révisions avec des questions récentes, des annotations personnelles, des commentaires collaboratifs et des statistiques intelligentes. Un écosystème complet pour apprendre mieux et plus vite.
               </p>
               <div className="flex flex-col sm:flex-row gap-4">
                 <Button 
                   size="lg"
                   onClick={() => router.push('/auth')}
                   className="bg-white text-medblue-600 hover:bg-medblue-50 font-bold text-lg md:text-xl px-8 md:px-10 py-4 md:py-5 shadow-2xl transform hover:scale-105 transition-all duration-300 rounded-xl border-2 border-white hover:border-medblue-200"
                 >
                   <span className="flex items-center gap-3">
                     Commencer
                     <ArrowRight className="w-5 h-5 md:w-6 md:h-6" />
                   </span>
                 </Button>
               </div>
             </div>
            <div className="hidden md:flex justify-center lg:justify-end">
              <div className="relative animate-float">
                {/* Main Device - Smaller */}
                <div className="w-64 h-72 md:w-80 md:h-[24rem] lg:w-80 lg:h-[24rem] bg-white rounded-3xl shadow-2xl p-4 md:p-6 transform rotate-1 hover:rotate-0 transition-all duration-500 hover:shadow-3xl border border-gray-100">
                   <div className="h-full bg-gradient-to-br from-medblue-50 via-medblue-100 to-medblue-150 rounded-2xl p-3 md:p-4 flex flex-col relative overflow-hidden">
                     {/* Subtle background pattern */}
                     <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-2xl"></div>
                    
                    {/* Header */}
                    <div className="relative z-10 flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-medblue-600 to-medblue-700 rounded-full flex items-center justify-center shadow-lg">
                        <Brain className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <span className="font-bold text-gray-800 text-lg">QCM / Session 2022</span>
                        <div className="text-xs text-medblue-600 font-medium">Retrecissement Mitral</div>
                      </div>
                    </div>
                    
                    {/* Question Content */}
                    <div className="relative z-10 flex-1 space-y-4">
                      <div className="space-y-2 p-3 bg-white/60 rounded-xl backdrop-blur-sm">
                        <div className="h-3 bg-gradient-to-r from-gray-300 to-gray-200 rounded w-full animate-pulse"></div>
                        <div className="h-3 bg-gradient-to-r from-gray-300 to-gray-200 rounded w-5/6 animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                        <div className="h-3 bg-gradient-to-r from-gray-300 to-gray-200 rounded w-4/5 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                        <div className="h-3 bg-gradient-to-r from-gray-300 to-gray-200 rounded w-3/4 animate-pulse" style={{ animationDelay: '0.3s' }}></div>
                      </div>
                      
                      {/* Answer Options */}
                      <div className="space-y-3 mt-6">
                        <div className="p-3 bg-white/80 rounded-xl border-2 border-gray-200 hover:border-medblue-300 hover:bg-white transition-all cursor-pointer shadow-sm hover:shadow-md">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 border-2 border-gray-300 rounded-full"></div>
                            <div className="h-2 bg-gray-300 rounded w-4/5"></div>
                          </div>
                        </div>
                        <div className="p-3 bg-gradient-to-r from-medblue-100 to-medblue-50 rounded-xl border-2 border-medblue-400 shadow-md transform scale-105">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-medblue-600 rounded-full flex items-center justify-center">
                              <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                            </div>
                            <div className="h-2 bg-medblue-500 rounded w-3/5"></div>
                          </div>
                        </div>
                        <div className="p-3 bg-white/80 rounded-xl border-2 border-gray-200 hover:border-medblue-300 hover:bg-white transition-all cursor-pointer shadow-sm hover:shadow-md">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 border-2 border-gray-300 rounded-full"></div>
                            <div className="h-2 bg-gray-300 rounded w-5/6"></div>
                          </div>
                        </div>
                        <div className="p-3 bg-white/80 rounded-xl border-2 border-gray-200 hover:border-medblue-300 hover:bg-white transition-all cursor-pointer shadow-sm hover:shadow-md">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 border-2 border-gray-300 rounded-full"></div>
                            <div className="h-2 bg-gray-300 rounded w-2/3"></div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Progress Footer */}
                      <div className="mt-6 pt-4 border-t border-white/50">
                        <div className="flex justify-between items-center">
                          <div className="text-xs text-gray-600 font-medium">Question 7/20</div>
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div className="w-7 h-1.5 bg-gradient-to-r from-medblue-500 to-medblue-600 rounded-full"></div>
                            </div>
                            <span className="text-xs text-gray-500">35%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Mobile Device - Smaller */}
                <div className="absolute -right-4 md:-right-6 top-10 md:top-12 w-16 h-36 md:w-24 md:h-48 bg-white rounded-3xl shadow-2xl p-3 transform -rotate-12 hover:rotate-6 transition-all duration-500 border border-gray-100">
                  <div className="h-full bg-gradient-to-b from-medblue-100 via-medblue-200 to-medblue-300 rounded-2xl p-2 flex flex-col relative overflow-hidden">
                    {/* Mobile header */}
                    <div className="w-full h-0.5 bg-gray-400 rounded-full mb-2"></div>
                    <div className="w-8 h-8 bg-medblue-500 rounded-lg mx-auto mb-2 flex items-center justify-center">
                      <Smartphone className="w-4 h-4 text-white" />
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 space-y-2">
                      <div className="h-2 bg-medblue-300 rounded w-full"></div>
                      <div className="h-1.5 bg-gray-300 rounded w-4/5"></div>
                      <div className="h-1.5 bg-gray-300 rounded w-3/5"></div>
                      
                      <div className="grid grid-cols-2 gap-1 mt-3">
                        <div className="h-6 bg-white rounded-md shadow-sm"></div>
                        <div className="h-6 bg-medblue-200 rounded-md"></div>
                        <div className="h-6 bg-white rounded-md shadow-sm"></div>
                        <div className="h-6 bg-white rounded-md shadow-sm"></div>
                      </div>
                      
                      <div className="mt-3 pt-1.5 border-t border-gray-200">
                        <div className="h-0.5 bg-medblue-500 rounded w-1/3"></div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Tablet Device - Smaller */}
                <div className="absolute -left-6 md:-left-10 top-16 md:top-20 w-28 h-20 md:w-36 md:h-24 bg-white rounded-2xl shadow-2xl p-3 transform rotate-12 hover:rotate-6 transition-all duration-500 border border-gray-100">
                  <div className="h-full bg-gradient-to-r from-medblue-100 via-medblue-200 to-medblue-300 rounded-xl p-2 flex items-center justify-center relative overflow-hidden">
                    {/* Tablet content */}
                    <div className="text-center w-full">
                      <div className="w-8 h-8 bg-gradient-to-br from-medblue-500 to-medblue-600 rounded-lg mx-auto mb-2 flex items-center justify-center">
                        <Tablet className="w-4 h-4 text-white" />
                      </div>
                      <div className="space-y-1">
                        <div className="h-1.5 bg-medblue-300 rounded w-16 mx-auto"></div>
                        <div className="h-1 bg-gray-300 rounded w-12 mx-auto"></div>
                        <div className="h-1 bg-gray-300 rounded w-10 mx-auto"></div>
                      </div>
                      
                      <div className="flex justify-center gap-1 mt-2">
                        <div className="w-1.5 h-1.5 bg-medblue-400 rounded-full"></div>
                        <div className="w-1.5 h-1.5 bg-gray-300 rounded-full"></div>
                        <div className="w-1.5 h-1.5 bg-gray-300 rounded-full"></div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Floating Elements for Extra Appeal */}
                <div className="absolute top-8 left-8 w-4 h-4 bg-medblue-400 rounded-full animate-ping opacity-75"></div>
                <div className="absolute bottom-16 right-16 w-6 h-6 bg-medblue-300 rounded-full animate-bounce opacity-60" style={{ animationDelay: '1s' }}></div>
                <div className="absolute top-32 -left-4 w-3 h-3 bg-medblue-500 rounded-full animate-pulse opacity-50" style={{ animationDelay: '2s' }}></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Characteristics Section */}
      <section id="caracteristiques" className="content-section py-14 md:py-20 bg-white" style={{ margin: 0 }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">Caractéristiques</h2>
            <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto">Tout ce dont vous avez besoin pour structurer une révision moderne, active et collaborative.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
             {characteristics.map((char, index) => (
               <Card key={index} className="group transition-all duration-500 border-0 bg-white shadow-none md:shadow-md md:hover:shadow-2xl md:hover:-translate-y-2 hover:bg-gradient-to-br hover:from-medblue-50 hover:to-white cursor-pointer">
                 <CardHeader className="text-center pb-4">
                   <div className="mx-auto w-20 h-20 bg-gradient-to-br from-medblue-100 to-medblue-200 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-125 group-hover:rotate-6 group-hover:bg-gradient-to-br group-hover:from-white group-hover:to-gray-50 transition-all duration-500 group-hover:shadow-xl shadow-md border border-medblue-100 group-hover:border-medblue-400">
                     <div className="text-medblue-600 group-hover:text-medblue-700 transition-colors duration-500 scale-125">
                       {char.icon}
                     </div>
                   </div>
                   <CardTitle className="text-xl font-bold text-gray-900 group-hover:text-medblue-700 transition-colors duration-300">{char.title}</CardTitle>
                 </CardHeader>
                 <CardContent className="text-center">
                   <CardDescription className="text-gray-600 leading-relaxed group-hover:text-gray-700 transition-colors duration-300">
                     {char.description}
                   </CardDescription>
                 </CardContent>
               </Card>
             ))}
           </div>
         </div>
       </section>

       {/* Features Section */}
       <section id="fonctionnalites" className="content-section py-14 md:py-20 bg-white" style={{ margin: 0 }}>
         <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">Fonctionnalités</h2>
            <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto">Des outils concrets pour améliorer l’efficacité de chaque session d’étude.</p>
          </div>
          {/* Alternating feature visuals with scroll-in animation */}
          <div className="space-y-20 mb-24">
            {[
              { img: 'https://r5p6ptp1nn.ufs.sh/f/6mc1qMI9JcrankWxbQScdBrWeUzJjF635MOI9ZHlv2aSpqsG', title: '📊 Statistiques détaillées ', text: 'Analysez vos résultats par matière, cours ou type de question. Identifiez vos points forts et vos lacunes pour progresser plus vite.' },
              { img: 'https://r5p6ptp1nn.ufs.sh/f/6mc1qMI9JcraLcNGLK4Atc53sOWFoHSjuyDCNgEkKav4epGB', title: '💬 Commentaire', text: 'Échangez vos idées, posez vos questions et profitez de l’intelligence collective en commentant chaque question ou cours.' },
              { img: 'https://r5p6ptp1nn.ufs.sh/f/6mc1qMI9JcrafKSTgvmZtjOao1y3n7S9hbL80uvp5AmF4DRV', title: '📅 Préparez-vous aux sessions plus facilement', text: 'Planifiez vos révisions, suivez vos progrès et arrivez serein aux examens grâce à des outils pensés pour votre réussite.' },
              { img: 'https://r5p6ptp1nn.ufs.sh/f/6mc1qMI9Jcra9sndk6A2Fbp6av1P8nZIcOmskB4olfuNQtYM', title: '📝 Prise de note', text: 'Notez vos idées, explications ou rappels directement dans l’app, sans perdre le fil de vos révisions.' },
              { img: 'https://r5p6ptp1nn.ufs.sh/f/6mc1qMI9JcraMvgQihbWmshq3xnTguLYEZF7dXpAcMID2bzk', title: '✏️ Souligner et épingler', text: 'Mettez en avant les points essentiels  , surlignez ce qui compte et epingler les questions que tu estimes pertinents pour vos revisions futures.' },

              { img: 'https://r5p6ptp1nn.ufs.sh/f/6mc1qMI9JcrammbnAb2LkC4c8KurQI92xYXT5gewfjFGbaq3', title: '⚡ Réviser efficacement et à ton propre rythme', text: 'Utiliser les statistiques pour cibler tes points faibles et profiter de nos 3 modes de revision' }
            ]
            .map((block, i) => {
              const imageAnim = i % 2 === 0 ? 'fade-right' : 'fade-left';
              const textAnim = i % 2 === 0 ? 'fade-left' : 'fade-right';
              return (
                <div key={block.title} className={`flex flex-col md:flex-row items-center gap-10 lg:gap-16 ${i % 2 === 1 ? 'md:flex-row-reverse' : ''}`}>
                  <div
                    data-aos={imageAnim}
                    data-aos-delay={i * 100}
                    className="relative w-full md:w-1/2 rounded-3xl overflow-hidden shadow-xl ring-1 ring-gray-200 bg-gradient-to-br from-gray-50 to-white min-h-[220px] md:min-h-[340px] lg:min-h-[420px]"
                  >
                    <Image
                      src={block.img}
                      alt={block.title}
                      fill
                      sizes="(max-width:768px) 100vw, 50vw"
                      className="object-contain"
                      quality={90}
                      priority={i<2}
                    />
                  </div>
                  <div
                    data-aos={textAnim}
                    data-aos-delay={(i * 100) + 200}
                    className="w-full md:w-1/2 space-y-4"
                  >
                    <h3 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">{block.title}</h3>
                    <p className="text-gray-600 text-lg leading-relaxed">{block.text}</p>
                  </div>
                </div>
              );
            })}
          </div>

         </div>
       </section>

       {/* Testimonials */}
       <section className="content-section py-14 md:py-20 bg-white" style={{ margin: 0 }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">Témoignages de nos utilisateurs</h2>
            <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto">Ils utilisent MedQ au quotidien pour structurer, accélérer et sécuriser leurs révisions.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map(t => (
              <Card key={t.name} className="border border-gray-200 shadow-lg bg-white hover:shadow-2xl hover:-translate-y-3 hover:border-medblue-300 transition-all duration-500 group cursor-pointer hover:bg-gradient-to-br hover:from-white hover:to-medblue-50">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <img src={t.photo} alt={t.name} className="w-14 h-14 rounded-full object-cover border border-medblue-200 group-hover:border-medblue-400 group-hover:scale-110 group-hover:shadow-lg transition-all duration-500" />
                    <div>
                      <CardTitle className="text-lg text-gray-900 font-semibold group-hover:text-medblue-700 transition-colors duration-300">{t.name}</CardTitle>
                      <CardDescription className="text-medblue-600 font-medium group-hover:text-medblue-800 transition-colors duration-300">{t.level}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 flex justify-start">
                    <div className="w-12 h-12 bg-gradient-to-br from-medblue-100 to-medblue-200 rounded-full flex items-center justify-center group-hover:bg-gradient-to-br group-hover:from-medblue-500 group-hover:to-medblue-600 transition-all duration-500 group-hover:scale-110 shadow-sm group-hover:shadow-md">
                      <Quote className="w-6 h-6 text-medblue-500 group-hover:text-white transition-colors duration-500" />
                    </div>
                  </div>
                  <p className="text-gray-600 leading-relaxed text-sm group-hover:text-gray-700 transition-colors duration-300">{t.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
         </div>
       </section>

  {/* Pricing section removed */}

       {/* FAQ Section */}
       <section id="faq" className="content-section py-14 md:py-20 bg-white" style={{ margin: 0 }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">FAQ</h2>
            <p className="text-lg md:text-xl text-gray-600">Les réponses aux questions les plus fréquentes.</p>
          </div>
          <div className="space-y-4">
             {faqItems.map((item, index) => (
               <Card key={index} className="border border-gray-200 shadow-sm bg-white hover:shadow-md transition-all duration-200">
                 <button
                   onClick={() => toggleFAQ(index)}
                   className="w-full text-left p-6 flex items-center justify-between hover:bg-medblue-50 transition-colors"
                 >
                   <span className="font-semibold text-gray-900 pr-4">{item.question}</span>
                   <ChevronDown
                     className={`w-5 h-5 text-medblue-500 transition-transform duration-200 ${
                       openFAQ === index ? 'rotate-180' : ''
                     }`}
                   />
                 </button>
                 {openFAQ === index && (
                   <div className="px-6 pb-6 border-t border-gray-100 bg-medblue-50">
                     <p className="text-gray-600 leading-relaxed pt-4">{item.answer}</p>
                   </div>
                 )}
               </Card>
             ))}
          </div>

          {/* Support CTA */}
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={openCrispChat}
              className="group inline-flex items-center justify-between w-full sm:w-auto gap-4 rounded-2xl px-5 py-3 bg-white border border-medblue-200 shadow-[0_2px_0_#e5f0ff,0_6px_16px_rgba(30,64,175,0.12)] hover:shadow-[0_2px_0_#dbeafe,0_10px_22px_rgba(30,64,175,0.18)] transition-all text-medblue-700 hover:text-medblue-800"
              aria-label="Une question non résolue ? Contactez notre support"
            >
              <span className="inline-flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full border-2 border-medblue-300 text-medblue-500">
                  <CircleHelp className="w-4 h-4" />
                </span>
                <span className="font-medium">Une question non résolue ? Contactez notre support</span>
              </span>
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-medblue-50 text-medblue-600 group-hover:bg-medblue-100">
                <Sparkles className="w-4 h-4" />
              </span>
            </button>
          </div>
         </div>
       </section>

       {/* CTA Section */}
       <section className="relative overflow-hidden py-16 md:py-20 bg-gradient-to-br from-medblue-600 to-medblue-800">
         {/* soft radial glow */}
         <div className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(75%_60%_at_50%_25%,rgba(255,255,255,0.18)_0%,rgba(255,255,255,0)_60%)]" />
         <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
           <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 md:mb-6 tracking-tight" data-aos="zoom-in" data-aos-delay="100">
             Prêt à Exceller?
           </h2>
           <p className="text-lg md:text-xl text-medblue-100/95 mb-8 max-w-2xl mx-auto" data-aos="fade-up" data-aos-delay="200">
             Ne révise plus comme hier. Essaie MedQ aujourd’hui
           </p>
           <div className="flex flex-col items-center gap-3" data-aos="fade-up" data-aos-delay="300">
             <Button 
               size="lg"
               onClick={() => router.push('/auth')}
               className="group bg-white text-medblue-600 hover:bg-medblue-50 font-semibold text-lg px-10 py-4 rounded-xl shadow-xl shadow-black/10 ring-1 ring-white/40 hover:ring-white/70 transition-all duration-200"
               aria-label="Commencer avec MedQ"
             >
               <span className="inline-flex items-center">
                 Commencer
                 <ArrowRight className="ml-2 w-5 h-5 transition-transform duration-200 group-hover:translate-x-0.5" />
               </span>
             </Button>
             <span className="text-xs md:text-sm text-medblue-100/80">Sans engagement. Accès immédiat.</span>
           </div>
         </div>
       </section>

       {/* Footer */}
  <footer className="bg-gradient-to-br from-gray-800 to-gray-900 text-white py-16 relative overflow-hidden">
   <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
           <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div data-aos="fade-up" data-aos-delay="100">
              <div className="mb-4" data-aos="fade-down" data-aos-delay="200">
                <Image
                  src="https://hbc9duawsb.ufs.sh/f/0SaNNFzuRrLwEhDtvz72VxFcMaBkoOH8vYK05Zd6q4mGPySp"
                  alt="MedQ logo"
                  width={160}
                  height={40}
                  className="h-8 w-auto object-contain"
                />
              </div>
               <p className="text-gray-300 leading-relaxed" data-aos="fade-up" data-aos-delay="300">
                 La plateforme d'apprentissage médical de référence pour les étudiants ambitieux.
               </p>
             </div>
             <div data-aos="fade-left" data-aos-delay="150">
               <h4 className="font-semibold mb-4 text-white" data-aos="fade-down" data-aos-delay="250">Plateforme</h4>
               <ul className="space-y-2 text-gray-300">
                 <li data-aos="fade-up" data-aos-delay="350"><button onClick={() => scrollToSection('fonctionnalites')} className="hover:text-medblue-300 transition-colors">Fonctionnalités</button></li>
                 {/* Tarifs link removed */}
                 <li data-aos="fade-up" data-aos-delay="450"><button type="button" onClick={openCrispChat} className="hover:text-medblue-300 transition-colors">Support</button></li>
               </ul>
             </div>
             <div data-aos="fade-right" data-aos-delay="200">
               <h4 className="font-semibold mb-4 text-white" data-aos="fade-down" data-aos-delay="300">Ressources</h4>
               <ul className="space-y-2 text-gray-300">
                 <li data-aos="fade-up" data-aos-delay="400"><Link href="/guide" className="hover:text-medblue-300 transition-colors">Guide d'utilisation</Link></li>
                 <li data-aos="fade-up" data-aos-delay="450">
                   <button onClick={() => scrollToSection('faq')} className="hover:text-medblue-300 transition-colors">FAQ</button>
                 </li>
                 <li data-aos="fade-up" data-aos-delay="500"><Link href="/privacy" className="hover:text-medblue-300 transition-colors">Politique de confidentialité</Link></li>
               </ul>
             </div>
             <div data-aos="fade-up" data-aos-delay="250">
               <h4 className="font-semibold mb-4 text-white" data-aos="fade-down" data-aos-delay="350">Suivez-nous</h4>
               <div className="flex space-x-4">
                 <a href="https://www.facebook.com/profile.php?id=61579896602303" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="w-10 h-10 bg-medblue-600 rounded-full flex items-center justify-center hover:bg-medblue-700 transition-colors transform hover:scale-110 duration-200" data-aos="zoom-in" data-aos-delay="450">
                   <Facebook className="w-5 h-5" />
                 </a>
                 <a href="https://www.instagram.com/medq.tn/" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="w-10 h-10 bg-medblue-600 rounded-full flex items-center justify-center hover:bg-medblue-700 transition-colors transform hover:scale-110 duration-200" data-aos="zoom-in" data-aos-delay="500">
                   <Instagram className="w-5 h-5" />
                 </a>
                 <a href="https://wa.me/?text=Bonjour%20MedQ" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center hover:bg-green-700 transition-colors transform hover:scale-110 duration-200" data-aos="zoom-in" data-aos-delay="550">
                   <MessageCircle className="w-5 h-5" />
                 </a>
                 <a href="mailto:medq.head@gmail.com" aria-label="Email" className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center hover:bg-red-700 transition-colors transform hover:scale-110 duration-200" data-aos="zoom-in" data-aos-delay="600">
                   <Mail className="w-5 h-5" />
                 </a>
               </div>
             </div>
           </div>
       <div className="border-t border-gray-700 pt-8 text-center">
             <p className="text-gray-400">
               © 2025 MedQ. Tous droits réservés. |
               <Link href="/privacy" className="hover:text-medblue-300">Politique de confidentialité</Link> |
               <Link href="/terms" className="hover:text-medblue-300">Conditions d'utilisation</Link>
             </p>
           </div>
         </div>
       </footer>
     </div>
   );
 }