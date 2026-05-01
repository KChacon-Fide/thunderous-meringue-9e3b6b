import { useEffect, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Send, Square, Bot, Plus, MessageSquare, ThumbsUp, ThumbsDown, Pencil, Check, X, Copy, RotateCcw } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

import { useKodexChat } from '@/lib/ai-hook'
import type { Message } from '@/lib/ai-hook'

// ── Tipos ────────────────────────────────────────────────────────
interface ChatSession {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
}

// ── Typing indicator ─────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-1 py-2">
      <span className="typing-dot" style={{ animationDelay: '0ms' }} />
      <span className="typing-dot" style={{ animationDelay: '160ms' }} />
      <span className="typing-dot" style={{ animationDelay: '320ms' }} />
    </div>
  )
}

// ── Message bubble ───────────────────────────────────────────────
function MessageBubble({
  message,
  isStreaming,
  isLoading,
  onFeedback,
  onEdit,
}: {
  message: Message
  isStreaming: boolean
  isLoading: boolean
  onFeedback: (id: string, feedback: 'like' | 'dislike') => void
  onEdit: (id: string, newText: string) => void
  onRegenerate: (id: string) => void
}) {
  const isUser = message.role === 'user'
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(message.content)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [editing])

  const handleConfirmEdit = () => {
    const trimmed = editText.trim()
    if (trimmed && trimmed !== message.content) {
      onEdit(message.id, trimmed)
    }
    setEditing(false)
  }

  const handleCancelEdit = () => {
    setEditText(message.content)
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleConfirmEdit()
    }
    if (e.key === 'Escape') handleCancelEdit()
  }

  return (
    <div className={`flex gap-3 items-start group ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isUser && (
        <div className="assistant-avatar flex-shrink-0">
          <Bot className="w-3.5 h-3.5 text-white" />
        </div>
      )}

      <div className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'} max-w-[80%]`}>
        {/* Bubble */}
        {isUser && editing ? (
          <div className="flex flex-col items-end gap-2" style={{ width: '60%', minWidth: '400px' }}>
            <textarea
              ref={textareaRef}
              value={editText}
              onChange={(e) => {
                setEditText(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = e.target.scrollHeight + 'px'
              }}
              onKeyDown={handleKeyDown}
              className="w-full resize-none px-4 py-3 text-sm leading-relaxed focus:outline-none"
              style={{
                background: '#0D1B3E',
                color: '#f1f5f9',
                borderRadius: '18px 18px 4px 18px',
                border: '2px solid #00C9C8',
                minHeight: '48px',
                width: '100%',
                minWidth: '400px',
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap',
                lineHeight: '1.6',
              }}
              rows={Math.max(2, editText.split('\n').length)}
            />
            <div className="flex gap-2">
              <button
                onClick={handleCancelEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
              >
                <X className="w-3 h-3" />
                Cancelar
              </button>
              <button
                onClick={handleConfirmEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#0D1B3E] text-white hover:bg-[#00C9C8] transition-colors"
              >
                <Check className="w-3 h-3" />
                Enviar
              </button>
            </div>
          </div>

        ) : isUser ? (
          <div className="user-bubble">
            <span className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</span>
          </div>
        ) : (
          <div className="assistant-bubble">
            {!message.content && isStreaming ? (
              <TypingIndicator />
            ) : (
              <div className="markdown">
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        {!editing && (
          <div className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
            {isUser && !isLoading && (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="p-1.5 rounded-md text-gray-400 hover:text-[#0D1B3E] hover:bg-gray-100 transition-colors"
                  title="Editar mensaje"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => navigator.clipboard.writeText(message.content)}
                  className="p-1.5 rounded-md text-gray-400 hover:text-[#0D1B3E] hover:bg-gray-100 transition-colors"
                  title="Copiar mensaje"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onRegenerate(message.id)}
                  className="p-1.5 rounded-md text-gray-400 hover:text-[#0D1B3E] hover:bg-gray-100 transition-colors"
                  title="Regenerar respuesta"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </>
            )}
            {!isUser && !isStreaming && (
              <>
                <button
                  onClick={() => navigator.clipboard.writeText(message.content)}
                  className="p-1.5 rounded-md text-gray-400 hover:text-[#0D1B3E] hover:bg-gray-100 transition-colors"
                  title="Copiar respuesta"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onFeedback(message.id, 'like')}
                  className={`p-1.5 rounded-md transition-colors ${message.feedback === 'like'
                    ? 'text-[#00C9C8] bg-[#00C9C8]/10'
                    : 'text-gray-400 hover:text-[#00C9C8] hover:bg-gray-100'
                    }`}
                  title="Buena respuesta"
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onFeedback(message.id, 'dislike')}
                  className={`p-1.5 rounded-md transition-colors ${message.feedback === 'dislike'
                    ? 'text-red-400 bg-red-50'
                    : 'text-gray-400 hover:text-red-400 hover:bg-gray-100'
                    }`}
                  title="Mala respuesta"
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

// ── Welcome screen ───────────────────────────────────────────────
function WelcomeScreen() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
      <div className="mb-5">
        <div className="w-14 h-14 rounded-2xl bg-white border border-gray-200 flex items-center justify-center mx-auto mb-4 shadow-sm">
          <Bot className="w-7 h-7 text-[#0D1B3E]" />
        </div>
        <h2 className="welcome-title">¿En qué puedo ayudarte?</h2>
        <p className="welcome-subtitle">Asistente inteligente de Kodex Tech Solutions</p>
      </div>
    </div>
  )
}

// ── Sidebar ──────────────────────────────────────────────────────
function Sidebar({
  sessions,
  activeId,
  onSelect,
  onNew,
}: {
  sessions: ChatSession[]
  activeId: string
  onSelect: (id: string) => void
  onNew: () => void
}) {
  return (
    <aside className="sidebar">
      <div className="px-4 py-5">
        <span className="sidebar-logo">KODEX IA</span>
      </div>
      <div className="px-3 mb-4">
        <button className="sidebar-new-chat" onClick={onNew}>
          <Plus className="w-4 h-4" />
          Nuevo chat
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-3">
        {sessions.length > 0 && (
          <>
            <p className="sidebar-section-title mb-2">Recientes</p>
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => onSelect(s.id)}
                className={`chat-history-item w-full text-left ${s.id === activeId ? 'active' : ''}`}
              >
                <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 opacity-50" />
                <span className="truncate">{s.title}</span>
              </button>
            ))}
          </>
        )}
      </div>
      <div className="sidebar-user">
        <div className="sidebar-avatar">KT</div>
        <span className="sidebar-username">Kodex Tech</span>
      </div>
    </aside>
  )
}

// ── Home ─────────────────────────────────────────────────────────
function Home() {
  const [input, setInput] = useState('')
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string>(() => crypto.randomUUID())
  const { messages, sendMessage, editAndResend, setFeedback, isLoading, stop, clearMessages, restoreMessages } = useKodexChat()
  const bottomRef = useRef<HTMLDivElement>(null)
  const savingRef = useRef(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Guardar mensajes en la sesión activa cada vez que cambian
  useEffect(() => {
    if (messages.length === 0) return
    if (savingRef.current) return
    const title = messages[0]?.content?.slice(0, 40) || 'Nueva conversación'
    setSessions((prev) => {
      const exists = prev.find((s) => s.id === activeSessionId)
      if (exists) {
        return prev.map((s) =>
          s.id === activeSessionId ? { ...s, messages: [...messages], title } : s
        )
      }
      return [
        { id: activeSessionId, title, messages: [...messages], createdAt: new Date() },
        ...prev,
      ]
    })
  }, [messages, activeSessionId])

  const handleNew = () => {
    const newId = crypto.randomUUID()
    setActiveSessionId(newId)
    clearMessages()
    setInput('')
  }

  const handleSelect = (id: string) => {
    if (id === activeSessionId) return
    // Guardar sesión actual antes de cambiar
    if (messages.length > 0) {
      const title = messages[0]?.content?.slice(0, 40) || 'Nueva conversación'
      setSessions((prev) => {
        const exists = prev.find((s) => s.id === activeSessionId)
        if (exists) {
          return prev.map((s) =>
            s.id === activeSessionId ? { ...s, messages: [...messages], title } : s
          )
        }
        return [
          { id: activeSessionId, title, messages: [...messages], createdAt: new Date() },
          ...prev,
        ]
      })
    }
    // Cargar sesión seleccionada
    const session = sessions.find((s) => s.id === id)
    savingRef.current = true
    setActiveSessionId(id)
    if (session) {
      restoreMessages(session.messages)
    } else {
      clearMessages()
    }
    savingRef.current = false
  }

  const handleSubmit = () => {
    const text = input.trim()
    if (!text || isLoading) return
    sendMessage(text)
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleEdit = (id: string, newText: string) => {
    editAndResend(id, newText)
  }
  const handleRegenerate = (id: string) => {
    const idx = messages.findIndex((m) => m.id === id)
    if (idx === -1) return
    // Buscamos el mensaje de usuario anterior
    const userMsg = messages.slice(0, idx).reverse().find((m) => m.role === 'user')
    if (!userMsg) return
    const history = messages.slice(0, idx - 1)
    sendMessage(userMsg.content, history)
  }
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        sessions={sessions}
        activeId={activeSessionId}
        onSelect={handleSelect}
        onNew={handleNew}
      />

      <div className="flex flex-col flex-1 min-w-0">
        <header className="main-header">
          <span className="text-sm font-semibold text-[#0D1B3E]">KODEX IA</span>
          <span className="header-model-badge">mistral-small</span>
        </header>

        <div className="chat-area flex flex-col flex-1 min-h-0 overflow-y-auto">
          {messages.length === 0 ? (
            <WelcomeScreen />
          ) : (
            <div className="messages-container">
              {messages.map((msg, i) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isStreaming={isLoading && i === messages.length - 1}
                  isLoading={isLoading}
                  onFeedback={setFeedback}
                  onEdit={handleEdit}
                  onRegenerate={handleRegenerate}
                />
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div className="input-area">
          {isLoading && (
            <div className="flex justify-center mb-3 max-w-[720px] mx-auto">
              <button onClick={stop} className="stop-btn">
                <Square className="w-3 h-3 fill-current" />
                Detener generación
              </button>
            </div>
          )}
          <div className="input-wrapper">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe un mensaje..."
              rows={1}
              disabled={isLoading}
              className="input-field disabled:opacity-50"
              style={{ maxHeight: '160px', overflowY: 'auto' }}
              onInput={(e) => {
                const t = e.currentTarget
                t.style.height = 'auto'
                t.style.height = Math.min(t.scrollHeight, 160) + 'px'
              }}
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || isLoading}
              className="send-btn"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="input-disclaimer">
            KODEX IA puede cometer errores. Verificá las respuestas importantes.
          </p>
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/')({
  component: Home,
})