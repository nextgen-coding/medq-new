'use client'

// Unified revision mode: simply redirect to core lecture page with mode=revision param
import { useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

export default function LectureRevisionRedirectPage() {
  const params = useParams()
  const router = useRouter()
  const search = useSearchParams()
  const lectureId = params?.lectureId as string
  const specialtyId = params?.specialtyId as string

  useEffect(() => {
    if (!lectureId || !specialtyId) return
    const base = `/exercices/${specialtyId}/lecture/${lectureId}`
    // Preserve existing query (except mode) then append mode=revision
    const other = Array.from(search?.entries() || []).filter(([k]) => k !== 'mode')
    const qs = new URLSearchParams(other as any)
    qs.set('mode', 'revision')
    router.replace(`${base}?${qs.toString()}`)
  }, [lectureId, specialtyId, router, search])

  return null
}
