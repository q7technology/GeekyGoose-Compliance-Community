import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'
import Sidebar from '../components/Sidebar'

export const metadata: Metadata = {
  title: 'GeekyGoose Compliance',
  description: 'Compliance automation platform for SMB + internal IT teams',
}

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-white">
        <div className="flex h-screen">
          <Sidebar />
          <main className="flex-1 overflow-auto lg:ml-0">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}