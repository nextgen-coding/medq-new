'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { CheckCircle2, PartyPopper, Sparkles, Mail, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { ForceLightTheme } from '@/components/ForceLightTheme';

export default function ComingSoonPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [burst, setBurst] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setBurst(true), 400);
    return () => clearTimeout(t);
  }, []);

  const confetti = useMemo(
    () =>
      Array.from({ length: 30 }).map((_, i) => ({
        id: i,
        left: `${(i * 23) % 100}%`,
        delay: Math.random() * 600,
        color: ['#2563eb', '#1d4ed8', '#0ea5e9', '#10b981', '#f59e0b'][i % 5],
        rotate: Math.random() * 360,
        scale: 0.8 + Math.random() * 0.6,
        duration: 2400 + Math.random() * 1600,
      })),
    []
  );

  const handleSignOut = async () => {
    try {
      await logout();
      router.push('/auth');
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-medblue-50 via-medblue-100 to-medblue-150 text-slate-800 overflow-hidden">
      <ForceLightTheme />

      {/* Background blobs */}
      <div className="pointer-events-none absolute -top-40 -left-40 w-[36rem] h-[36rem] rounded-full bg-medblue-200/60 blur-3xl animate-[float_12s_ease-in-out_infinite]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 w-[36rem] h-[36rem] rounded-full bg-medblue-300/50 blur-3xl animate-[float_15s_ease-in-out_infinite_reverse]" />

      <main className="relative z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 md:py-20">
          {/* Logo */}
          <div className="flex justify-center animate-[fadeInUp_600ms_ease_150ms_both] mb-4 md:mb-6">
            <Image
              src="https://hbc9duawsb.ufs.sh/f/0SaNNFzuRrLwc6JmYDs7xU9KRorsOPBFM3XfQgEkDm2yuiLj"
              alt="MedQ"
              width={220}
              height={64}
              sizes="(max-width: 640px) 160px, 220px"
              className="h-12 sm:h-14 w-auto object-contain"
              priority
            />
          </div>

          {/* Badge */}
          <div className="mx-auto w-28 h-28 md:w-32 md:h-32 rounded-full bg-white/80 backdrop-blur-sm border border-slate-200 flex items-center justify-center relative shadow-sm">
            <svg viewBox="0 0 120 120" className="absolute inset-0">
              <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(2,6,23,0.08)" strokeWidth="4" />
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke="#10b981"
                strokeWidth="4"
                strokeLinecap="round"
                style={{ strokeDasharray: 330, strokeDashoffset: burst ? 0 : 330, transition: 'stroke-dashoffset 900ms ease 150ms' }}
              />
            </svg>
            <CheckCircle2 className={`w-14 h-14 md:w-16 md:h-16 text-emerald-500 transition-all duration-700 ${burst ? 'scale-100 opacity-100' : 'scale-75 opacity-0'}`} />
            <PartyPopper className={`absolute -top-3 -right-3 w-6 h-6 text-amber-500 transition-all duration-700 ${burst ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'}`} />
          </div>

          <h1 className="mt-8 text-center text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900">Félicitations.</h1>
          <p className="mt-3 text-center text-slate-600 text-lg max-w-2xl mx-auto">
            Votre compte a été créé avec succès et vous faites maintenant partie de notre communauté. Vous serez parmi les premiers à découvrir notre plateforme.
          </p>

          <div className="mt-10 mx-auto max-w-xl rounded-xl border border-slate-200 bg-white/80 backdrop-blur p-4 flex items-center gap-3 text-slate-700 shadow-sm">
            <Mail className="w-5 h-5 text-slate-500" />
            <p className="text-sm">Nous vous enverrons un e‑mail dès l’ouverture officielle.</p>
          </div>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button asChild className="bg-medblue-600 hover:bg-medblue-700 text-white rounded-full h-11 px-6 shadow-lg hover:shadow-xl transition-all">
                <a href="https://www.facebook.com/profile.php?id=61579896602303" target="_blank" rel="noopener noreferrer">
                  Découvrir MedQ <Sparkles className="w-4 h-4 ml-2" />
                </a>
              </Button>
              <Button variant="outline" className="border-medblue-300 text-medblue-700 hover:bg-medblue-50 rounded-full h-11 px-6" onClick={handleSignOut}>
                <LogOut className="w-4 h-4 mr-2" /> Se déconnecter
              </Button>
            </div>
        </div>
      </main>

      {/* Confetti */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {confetti.map((c) => (
          <span
            key={c.id}
            style={{ left: c.left, animationDelay: `${burst ? c.delay : 9999}ms`, transform: `rotate(${c.rotate}deg) scale(${c.scale})`, animationDuration: `${c.duration}ms`, backgroundColor: c.color }}
            className={`absolute top-[-10%] inline-block w-2 h-3 rounded-sm opacity-0 ${burst ? 'confetti' : ''}`}
          />
        ))}
      </div>

      <style jsx global>{`
        @keyframes confettiDrop { 0% { transform: translate3d(0,-20%,0) rotate(0deg) scale(var(--s,1)); opacity: 0; } 10% { opacity: 1; } 100% { transform: translate3d(0,120vh,0) rotate(360deg) scale(var(--s,1)); opacity: 0; } }
        .confetti { animation-name: confettiDrop; animation-timing-function: cubic-bezier(.2,.8,.2,1); }
        @keyframes float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(18px) } }
        @keyframes fadeInUp { 0% { opacity:0; transform: translateY(8px);} 100% { opacity:1; transform: translateY(0);} }
      `}</style>
    </div>
  );
}
