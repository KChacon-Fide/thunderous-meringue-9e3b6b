import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/transcribe')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const formData = await request.formData()
          const audio = formData.get('audio')

          if (!(audio instanceof File) || audio.size === 0) {
            return Response.json({ error: 'Audio invalido' }, { status: 400 })
          }

          const apiKey = (globalThis as any).__MISTRAL_KEY__ || process.env.Mistral_API_Kodex
          if (!apiKey) {
            return Response.json({ error: 'Mistral no configurado' }, { status: 500 })
          }

          const mistralForm = new FormData()
          mistralForm.append('model', 'voxtral-mini-latest')
          mistralForm.append('language', 'es')
          mistralForm.append('file', audio, audio.name || 'voice.webm')

          const mistralRes = await fetch('https://api.mistral.ai/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
            body: mistralForm,
          })

          if (!mistralRes.ok) {
            const detail = await mistralRes.text()
            console.error('Mistral transcription error:', detail)
            return Response.json(
              { error: 'No se pudo transcribir el audio', detail },
              { status: 502 },
            )
          }

          const data = await mistralRes.json()
          return Response.json({ text: String(data.text ?? '').trim() })
        } catch (error) {
          console.error('Transcription route error:', error)
          return Response.json({ error: 'Error procesando audio' }, { status: 500 })
        }
      },
    },
  },
})
