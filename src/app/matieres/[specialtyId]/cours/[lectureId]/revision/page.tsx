'use client'

import { useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

// Simple redirect page for revision mode to reuse the main cours UI
export default function CoursRevisionRedirectPage() {
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
    qs.set('mode', 'revision');
    router.replace(`${base}?${qs.toString()}`);
  }, [lectureId, specialtyId, router, search]);

  return null;
}
