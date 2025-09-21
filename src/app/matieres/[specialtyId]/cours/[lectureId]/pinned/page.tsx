'use client'

import { useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

// Redirect page for pinned mode to reuse the main cours UI with ?mode=pinned
export default function CoursPinnedRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const search = useSearchParams();
  const lectureId = params?.lectureId as string;
  const specialtyId = params?.specialtyId as string;

  useEffect(() => {
    if (!lectureId || !specialtyId) return;
    const base = `/matieres/${specialtyId}/cours/${lectureId}`;
    const other = Array.from(search?.entries() || []).filter(([k]) => k !== 'mode');
    const qs = new URLSearchParams(other as any);
    qs.set('mode', 'pinned');
    router.replace(`${base}?${qs.toString()}`);
  }, [lectureId, specialtyId, router, search]);

  return null;
}
