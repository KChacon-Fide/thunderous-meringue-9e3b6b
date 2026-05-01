import { createFileRoute } from '@tanstack/react-router'

const SYSTEM_PROMPT =
  'You are KODEX IA, a professional and intelligent assistant created by Kodex Tech Solutions. ' +
  'Always respond in the same language the user writes in. ' +
  'Never use emojis under any circumstance. ' +
  'Keep greetings and short questions brief and direct — one or two sentences maximum. ' +
  'For detailed requests, write long well-structured responses with headers, numbered lists and proper paragraphs. ' +
  'Never end responses with phrases like "Do you need more info?" or "I am here to help" or similar. ' +
  'Use proper punctuation always. Be human, clear and professional in tone.'
export const Route = createFileRoute('/api/chat')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (request.signal.aborted) {
          return new Response(null, { status: 499 })
        }

        try {
          const { messages } = await request.json()

          const apiKey = (globalThis as any).__MISTRAL_KEY__ || process.env.Mistral_API_Kodex

          if (!apiKey) {
            return new Response(
              JSON.stringify({ error: 'MISTRAL_API_KEY not configured' }),
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
                max_tokens: 8192,
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