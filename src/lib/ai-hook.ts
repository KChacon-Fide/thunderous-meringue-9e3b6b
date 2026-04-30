import { useCallback, useRef, useState } from 'react'

export type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export function useKodexChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const stop = useCallback(() => {
    abortRef.current?.abort()
    setIsLoading(false)
  }, [])

  const sendMessage = useCallback(
    async (text: string) => {
      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text,
      }

      const assistantId = crypto.randomUUID()
      const assistantMsg: Message = {
        id: assistantId,
        role: 'assistant',
        content: '',
      }

      setMessages((prev) => [...prev, userMsg, assistantMsg])
      setIsLoading(true)

      const controller = new AbortController()
      abortRef.current = controller

      try {
        // Build the messages array for the API (exclude the empty assistant placeholder)
        const history = [...messages, userMsg].map((m) => ({
          role: m.role,
          content: m.content,
        }))

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: history }),
          signal: controller.signal,
        })

        if (!res.ok || !res.body) {
          throw new Error(`HTTP ${res.status}`)
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed.startsWith('data:')) continue
            const payload = trimmed.slice(5).trim()
            if (payload === '[DONE]') break

            try {
              const chunk = JSON.parse(payload)
              const delta = chunk?.choices?.[0]?.delta?.content
              if (delta) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content + delta }
                      : m,
                  ),
                )
              }
            } catch {
              // skip malformed chunks
            }
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content:
                      'An error occurred while processing your request. Please try again.',
                  }
                : m,
            ),
          )
        }
      } finally {
        setIsLoading(false)
      }
    },
    [messages],
  )

  return { messages, sendMessage, isLoading, stop }
}
