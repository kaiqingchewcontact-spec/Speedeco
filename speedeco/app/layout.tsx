import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Speedeco — Turn thinking into slides',
  description: 'Paste anything. Get a sharp, copyable slide deck in seconds.',
  openGraph: {
    title: 'Speedeco — Arc Intelligence',
    description: 'Paste your thinking. Walk away with a deck.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
