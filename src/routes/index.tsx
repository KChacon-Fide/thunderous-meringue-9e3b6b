import { useEffect, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Send, Square, Bot, User } from 'lucide-react'

import { useKodexChat } from '@/lib/ai-hook'
import type { Message } from '@/lib/ai-hook'

function KodexLogo() {
  return (
    <span className="kodex-logo text-2xl font-bold tracking-widest select-none">
      KODEX IA
    </span>
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-1 py-2">
      <span className="typing-dot" style={{ animationDelay: '0ms' }} />
      <span className="typing-dot" style={{ animationDelay: '160ms' }} />
      <span className="typing-dot" style={{ animationDelay: '320ms' }} />
    </div>
  )
}

function MessageBubble({ message, isStreaming }: { message: Message; isStreaming: boolean }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start`}>
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? 'bg-cyan-avatar' : 'bg-navy-avatar'
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4 text-navy" />
        ) : (
          <Bot className="w-4 h-4 text-cyan" />
        )}
      </div>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'user-bubble'
            : 'assistant-bubble'
        }`}
      >
        {!isUser && !message.content && isStreaming ? (
          <TypingIndicator />
        ) : (
          <span className="whitespace-pre-wrap">{message.content}</span>
        )}
      </div>
    </div>
  )
}

function WelcomeScreen() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 opacity-20">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
          <rect x="8" y="8" width="48" height="48" rx="12" stroke="#00C9C8" strokeWidth="2" />
          <path d="M20 32h24M32 20v24" stroke="#00C9C8" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-slate-300 mb-2">How can I help you?</h2>
      <p className="text-sm text-slate-500 max-w-sm">
        Ask me anything. I'm your intelligent assistant from Kodex Tech Solutions.
      </p>
    </div>
  )
}

function ChatMessages({ messages, isLoading }: { messages: Message[]; isLoading: boolean }) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  if (!messages.length) return <WelcomeScreen />

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 min-h-0">
      <div className="max-w-2xl mx-auto flex flex-col gap-5">
        {messages.map((msg, i) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isStreaming={isLoading && i === messages.length - 1}
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

function Home() {
  const [input, setInput] = useState('')
  const { messages, sendMessage, isLoading, stop } = useKodexChat()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || isLoading) return
    sendMessage(text)
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as any)
    }
  }

  return (
    <div className="flex flex-col h-screen app-bg">
      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-6 py-4 header-border">
        <KodexLogo />
        <span className="text-xs text-slate-500 tracking-widest uppercase font-medium">
          Kodex Tech Solutions
        </span>
      </header>

      {/* Messages */}
      <ChatMessages messages={messages} isLoading={isLoading} />

      {/* Input area */}
      <div className="flex-shrink-0 px-4 py-4 input-area-border">
        <div className="max-w-2xl mx-auto">
          {isLoading && (
            <div className="flex justify-center mb-3">
              <button
                onClick={stop}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium stop-btn transition-colors"
              >
                <Square className="w-3 h-3 fill-current" />
                Stop generating
              </button>
            </div>
          )}
          <form onSubmit={handleSubmit} className="relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message KODEX IA..."
              rows={1}
              disabled={isLoading}
              className="w-full resize-none rounded-xl px-4 py-3 pr-12 text-sm input-field focus:outline-none disabled:opacity-50 leading-relaxed"
              style={{ maxHeight: '160px', overflowY: 'auto' }}
              onInput={(e) => {
                const t = e.currentTarget
                t.style.height = 'auto'
                t.style.height = Math.min(t.scrollHeight, 160) + 'px'
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="absolute right-3 bottom-3 p-1.5 rounded-lg send-btn disabled:opacity-30 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <p className="text-center text-xs text-slate-600 mt-2">
            KODEX IA may produce inaccurate information. Verify important responses.
          </p>
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/')({
  component: Home,
})
