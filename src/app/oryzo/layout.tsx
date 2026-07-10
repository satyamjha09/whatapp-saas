import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "ORYZO - So portable, it's wearable",
  description:
    'Cinematic pinned-scroll horizontal gallery section (standalone recreation)',
}

export default function OryzoLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return children
}
