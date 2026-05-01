import { defineConfig, loadEnv } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const mistralKey = env['Mistral_API_Kodex'] || ''

  console.log('Mistral key encontrada:', mistralKey ? 'SÍ ✅' : 'NO ❌')

  return {
    define: {
      'globalThis.__MISTRAL_KEY__': JSON.stringify(mistralKey),
    },
    server: {
      hmr: true,
    },
    plugins: [
      viteTsConfigPaths({
        projects: ['./tsconfig.json'],
      }),
      tailwindcss(),
      tanstackStart({
        server: {
          preset: 'node', // 🔥 CLAVE PARA RAILWAY
        },
      }),
      viteReact(),
    ],
  }
})

export default config