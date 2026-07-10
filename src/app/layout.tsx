import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: '--font-plus-jakarta-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'metawhat',
  description: 'Premium WhatsApp Business workflow dashboard',
  icons: {
    icon: '/brand/metawhat-mark.png',
    apple: '/brand/metawhat-mark.png',
  },
}

function getAllowedRedirectOrigins() {
  const origins = new Set<string>([
    'http://localhost:3000',
    'https://localhost:3000',
  ])
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL

  if (appUrl) {
    try {
      origins.add(new URL(appUrl).origin)
    } catch {
      // Ignore invalid local configuration; Clerk will still use its defaults.
    }
  }

  return [...origins]
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const allowedRedirectOrigins = getAllowedRedirectOrigins()

  return (
    <html lang="en">
      <body className={`${plusJakartaSans.variable} antialiased`}>
        <ClerkProvider
          dynamic
          allowedRedirectOrigins={allowedRedirectOrigins}
          allowedRedirectProtocols={['http', 'https']}
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  )
}
