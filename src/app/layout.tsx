import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/Providers'
import CrispChat from '@/components/CrispChat'
import { NextSSRPlugin } from "@uploadthing/react/next-ssr-plugin";
import { extractRouterConfig } from "uploadthing/server";
import { ourFileRouter } from "@/app/api/uploadthing/core";

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'Medq',
    template: '%s – Medq',
  },
  description: 'A platform for medical education and question management',
  icons: {
    icon: 'https://r5p6ptp1nn.ufs.sh/f/6mc1qMI9JcraFSYUmbide7MKPVFpROQi36XnZbchzSA1G4ax',
    shortcut: 'https://r5p6ptp1nn.ufs.sh/f/6mc1qMI9JcraFSYUmbide7MKPVFpROQi36XnZbchzSA1G4ax',
    apple: 'https://r5p6ptp1nn.ufs.sh/f/6mc1qMI9JcraFSYUmbide7MKPVFpROQi36XnZbchzSA1G4ax',
  },
}

// Ensure proper mobile responsiveness
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
  <html lang="en">
  <body className={`${inter.className} overflow-x-hidden min-h-screen h-full w-full`}>
    {/* Preload PDF worker to avoid race conditions in production */}
    <link rel="preload" as="script" href="/pdf.worker.min.mjs" />
    <link rel="prefetch" href="/pdf.worker.min.mjs" />
        <NextSSRPlugin
          /**
           * The `extractRouterConfig` will extract **only** the route configs
           * from the router to prevent additional information from being
           * leaked to the client. The data passed to the client is the same
           * as if you were to fetch `/api/uploadthing` directly.
           */
          routerConfig={extractRouterConfig(ourFileRouter)}
        />
        <Providers>
          {/* Crisp live chat widget (needs AuthProvider) */}
          <CrispChat />
          {children}
        </Providers>
      </body>
    </html>
  )
}