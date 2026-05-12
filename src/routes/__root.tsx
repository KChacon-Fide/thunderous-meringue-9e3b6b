import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

import { getInitialAppearanceScript } from '@/lib/appearance'
import '../styles.css'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'KODEX IA — Kodex Tech Solutions' },
      { name: 'description', content: 'Intelligent AI assistant by Kodex Tech Solutions' },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: getInitialAppearanceScript() }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
