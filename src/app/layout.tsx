import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Owlaris — Tutor IA Académico',
  description: 'Tu tutor inteligente, disponible siempre.',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${inter.className} bg-owlaris-light text-gray-900 antialiased`}>
        {children}
      </body>
    </html>
  )
}
