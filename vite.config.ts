import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import netlify from '@netlify/vite-plugin-tanstack-start'
import { loadEnv } from 'vite'

const config = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const mistralKey = env['Mistral_API_Kodex'] || ''
  console.log('Mistral key encontrada:', mistralKey ? 'SÍ ✅' : 'NO ❌')

  return {
    define: {
      'globalThis.__MISTRAL_KEY__': JSON.stringify(mistralKey),
    },
    plugins: [
      viteTsConfigPaths({
        projects: ['./tsconfig.json'],
      }),
      tailwindcss(),
      netlify(),
      tanstackStart(),
      viteReact(),
    ],
  }
})

export default config