import { createFileRoute } from '@tanstack/react-router'

const SYSTEM_PROMPT =
  'You are KODEX IA, an intelligent and efficient assistant created by Kodex Tech Solutions. You give clear, concise and accurate answers. You are professional, direct and helpful. Avoid unnecessary filler text.'

export const Route = createFileRoute('/api/chat')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (request.signal.aborted) {
          return new Response(null, { status: 499 })
        }

        try {
          const { messages } = await request.json()

          const apiKey = process.env.Mistral_IA_Kodex
          if (!apiKey) {
            return new Response(
              JSON.stringify({ error: 'Mistral_IA_Kodex not configured' }),
              { status: 500, headers: { 'Content-Type': 'application/json' } },
            )
          }

          const mistralMessages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...messages.map((m: { role: string; content: string }) => ({
              role: m.role,
              content: m.content,
            })),
          ]

          const mistralRes = await fetch(
            'https://api.mistral.ai/v1/chat/completions',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model: 'mistral-small-latest',
                messages: mistralMessages,
                temperature: 0.5,
                max_tokens: 800,
                stream: true,
              }),
              signal: request.signal,
            },
          )

          if (!mistralRes.ok) {
            const err = await mistralRes.text()
            return new Response(
              JSON.stringify({ error: 'Mistral API error', detail: err }),
              { status: 502, headers: { 'Content-Type': 'application/json' } },
            )
          }

          // Proxy the Mistral SSE stream directly
          return new Response(mistralRes.body, {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              Connection: 'keep-alive',
            },
          })
        } catch (error: any) {
          if (error.name === 'AbortError') {
            return new Response(null, { status: 499 })
          }
          console.error('Chat error:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to process request' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
          )
        }
      },
    },
  },
})
