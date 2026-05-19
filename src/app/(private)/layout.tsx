import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { NewsCarousel } from '@/components/news-carousel'

export default async function PrivateLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    redirect('/sign-in')
  }

  return (
    <div className="flex flex-col min-h-screen">
      <NewsCarousel />
      {children}
    </div>
  )
}
