'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

export default function RouteTheme() {
  const pathname = usePathname()

  useEffect(() => {
    const root = document.documentElement
    const p = pathname || ''

    // Define which routes should use medical blue theme
    const isMedicalBlueArea =
      p.startsWith('/admin') ||
      p.startsWith('/dashboard') ||
      p.startsWith('/matieres') ||
      p.startsWith('/lecture') ||
      p.startsWith('/profile') ||
      p.startsWith('/settings') ||
      p.startsWith('/specialty')

    if (isMedicalBlueArea) {
      root.setAttribute('data-theme', 'med-blue')
    } else {
      root.removeAttribute('data-theme')
    }
  }, [pathname])

  return null
}
