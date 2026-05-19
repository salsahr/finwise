'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Home } from 'lucide-react'

export function BackToHome() {
  const pathname = usePathname()

  // Don't show on the main dashboard
  if (pathname === '/dashboard' || pathname === '/dashboard/') return null

  return (
    <Link
      href="/dashboard"
      className="back-to-home-btn"
    >
      <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
      <Home className="h-3.5 w-3.5" />
      <span>Início</span>
    </Link>
  )
}
