import { useEffect, useRef, useState, useCallback } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Send, Square, Bot, Plus, MessageSquare, ThumbsUp, ThumbsDown, Pencil, Check, X, Copy, RotateCcw, Paperclip, FileText, Mic, MicOff, AudioLines, Menu } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

import { useKodexChat } from '@/lib/ai-hook'
import { useKodexAppearance } from '@/lib/appearance'
import { useAuth } from '@/lib/auth-hook'
import type { EmailVerificationType } from '@/lib/auth-hook'
import { AuthModal } from '@/components/AuthModal'
import { UserMenu } from '@/components/UserMenu'
import { parseFile, formatFileForPrompt, getSupportedExtensions, type ParsedFile } from '@/lib/file-parser'
import {
  speakWithVoiceProfile,
  textForSpeech,
  useSpeechVoices,
  useVoiceProfile,
} from '@/lib/voice-settings'
import {
  loadConversations,
  createConversation,
  updateConversationTitle,
  deleteConversation,
  loadMessages,
  saveMessage,
  updateMessageFeedback,
  type Conversation,
} from '@/lib/conversations'
import type { Message } from '@/lib/ai-hook'

function useVoiceInput(_onResult: (text: string) => void) {
  return {
    listening: false,
    supported: false,
    bars: [] as number[],
    startListening: () => undefined,
    stopListening: () => undefined,
  }
}

// ── Voice input hook ─────────────────────────────────────────────
// ── Voice button component ────────────────────────────────────────
function VoiceButton({ onResult, disabled }: { onResult: (text: string) => void, disabled: boolean }) {
  const { listening, supported, bars, startListening, stopListening } = useVoiceInput(onResult)

  if (!supported) return null

  return (
    <div className="flex items-center flex-shrink-0">
      {listening && (
        <div className="flex items-end gap-[2px] mr-2 h-5">
          {bars.map((h, i) => (
            <div
              key={i}
              className="w-[3px] rounded-full transition-all duration-75"
              style={{
                height: `${h}%`,
                background: `rgba(0, 201, 200, ${0.4 + (h / 100) * 0.6})`,
                minHeight: '3px',
              }}
            />
          ))}
        </div>
      )}
      <button
        onClick={listening ? stopListening : startListening}
        disabled={disabled}
        title={listening ? 'Detener grabación' : 'Hablar'}
        className={`p-2 rounded-lg transition-colors disabled:opacity-40 flex-shrink-0 ${listening
            ? 'text-[#00C9C8] bg-[#00C9C8]/10 hover:bg-[#00C9C8]/20'
            : 'text-gray-400 hover:text-[#0D1B3E] hover:bg-gray-100'
          }`}
      >
        {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
      </button>
    </div>
  )
}

const KODEX_VOICE_BAR_COUNT = 28

type BrowserSpeechRecognitionResult = {
  isFinal: boolean
  [index: number]: { transcript: string }
}

type BrowserSpeechRecognitionEvent = {
  resultIndex: number
  results: {
    length: number
    [index: number]: BrowserSpeechRecognitionResult
  }
}

type BrowserSpeechRecognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type BrowserSpeechRecognitionCtor = new () => BrowserSpeechRecognition

function getSpeechRecognitionCtor(): BrowserSpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  return ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) ?? null
}

async function transcribeAudioBlob(blob: Blob) {
  if (blob.size < 800) return ''

  const formData = new FormData()
  const extension = blob.type.includes('ogg') ? 'ogg' : 'webm'
  formData.append('audio', blob, `voice.${extension}`)

  const res = await fetch('/api/transcribe', {
    method: 'POST',
    body: formData,
  })

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(data?.error || 'No se pudo transcribir el audio.')
  }

  return String(data?.text ?? '').trim()
}

function getRecorderMimeType() {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ]

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || ''
}

function useKodexVoice(options: {
  onFinalText?: (text: string) => void
  onInterimText?: (text: string) => void
  preferLiveRecognition?: boolean
} = {}) {
  const preferLiveRecognition = options.preferLiveRecognition ?? false
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(true)
  const [error, setError] = useState('')
  const [volume, setVolume] = useState(0)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [usingLiveRecognition, setUsingLiveRecognition] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const frameRef = useRef<number>(0)
  const keepRecognitionAliveRef = useRef(false)
  const onFinalTextRef = useRef(options.onFinalText)
  const onInterimTextRef = useRef(options.onInterimText)
  const [bars, setBars] = useState<number[]>(Array(KODEX_VOICE_BAR_COUNT).fill(8))

  useEffect(() => {
    onFinalTextRef.current = options.onFinalText
    onInterimTextRef.current = options.onInterimText
  }, [options.onFinalText, options.onInterimText])

  useEffect(() => {
    const supportsMicrophone = !!navigator.mediaDevices?.getUserMedia
    const supportsRecorder = typeof window !== 'undefined' && !!window.MediaRecorder
    const supportsRecognition = !!getSpeechRecognitionCtor()
    setSupported(supportsMicrophone && (preferLiveRecognition ? supportsRecognition || supportsRecorder : supportsRecorder))
  }, [preferLiveRecognition])

  const cleanupAudio = useCallback(() => {
    cancelAnimationFrame(frameRef.current)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    audioCtxRef.current?.close().catch(() => undefined)
    streamRef.current = null
    analyserRef.current = null
    audioCtxRef.current = null
    setVolume(0)
    setBars(Array(KODEX_VOICE_BAR_COUNT).fill(8))
  }, [])

  const resetTranscript = useCallback(() => {
    chunksRef.current = []
    setTranscript('')
    setInterimTranscript('')
  }, [])

  const stopListening = useCallback(async (clearAudio = false) => {
    keepRecognitionAliveRef.current = false
    const recognition = recognitionRef.current
    if (recognition) {
      recognition.onend = null
      recognition.onresult = null
      recognition.onerror = null
      try {
        clearAudio ? recognition.abort() : recognition.stop()
      } catch {
        try { recognition.abort() } catch {}
      }
      recognitionRef.current = null
    }

    const recorder = recorderRef.current
    const mimeType = recorder?.mimeType || 'audio/webm'

    const blob = await new Promise<Blob | null>((resolve) => {
      if (!recorder || recorder.state === 'inactive') {
        resolve(chunksRef.current.length ? new Blob(chunksRef.current, { type: mimeType }) : null)
        return
      }

      recorder.onstop = () => {
        resolve(chunksRef.current.length ? new Blob(chunksRef.current, { type: mimeType }) : null)
      }

      try {
        recorder.requestData()
        recorder.stop()
      } catch {
        resolve(chunksRef.current.length ? new Blob(chunksRef.current, { type: mimeType }) : null)
      }
    })

    recorderRef.current = null
    cleanupAudio()
    if (clearAudio) resetTranscript()
    setListening(false)
    setUsingLiveRecognition(false)
    return clearAudio ? null : blob
  }, [cleanupAudio, resetTranscript])

  const startListening = useCallback(async () => {
    if (!supported || recorderRef.current || recognitionRef.current) return

    try {
      window.speechSynthesis?.cancel()
      resetTranscript()
      setError('')

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext
      const audioCtx = new AudioContextCtor()
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 64
      analyser.smoothingTimeConstant = 0.65
      source.connect(analyser)
      analyserRef.current = analyser
      audioCtxRef.current = audioCtx

      const timeData = new Uint8Array(analyser.fftSize)
      const animate = () => {
        const data = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(data)
        analyser.getByteTimeDomainData(timeData)

        let sum = 0
        for (const value of timeData) {
          const normalized = (value - 128) / 128
          sum += normalized * normalized
        }
        const rms = Math.sqrt(sum / timeData.length)
        setVolume(Math.min(1, rms * 4.5))

        setBars(Array.from({ length: KODEX_VOICE_BAR_COUNT }, (_, i) => {
          const idx = Math.floor((i * data.length) / KODEX_VOICE_BAR_COUNT)
          return Math.min(100, Math.max(10, (data[idx] / 180) * 100))
        }))
        frameRef.current = requestAnimationFrame(animate)
      }
      animate()

      const SpeechRecognitionCtor = preferLiveRecognition ? getSpeechRecognitionCtor() : null
      if (SpeechRecognitionCtor) {
        const recognition = new SpeechRecognitionCtor()
        recognition.lang = 'es-CR'
        recognition.continuous = true
        recognition.interimResults = true
        recognition.maxAlternatives = 1
        keepRecognitionAliveRef.current = true

        recognition.onresult = (event) => {
          let finalText = ''
          let interimText = ''

          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            const result = event.results[i]
            const text = result[0]?.transcript?.trim() ?? ''
            if (!text) continue
            if (result.isFinal) finalText += `${text} `
            else interimText += `${text} `
          }

          const cleanInterim = interimText.trim()
          setInterimTranscript(cleanInterim)
          if (cleanInterim) onInterimTextRef.current?.(cleanInterim)

          const cleanFinal = finalText.trim()
          if (cleanFinal) {
            setTranscript((current) => current ? `${current} ${cleanFinal}` : cleanFinal)
            setInterimTranscript('')
            onFinalTextRef.current?.(cleanFinal)
          }
        }

        recognition.onerror = (event) => {
          if (event.error === 'no-speech' || event.error === 'aborted') return
          setError('No se pudo mantener la escucha activa.')
        }

        recognition.onend = () => {
          if (!keepRecognitionAliveRef.current) return
          window.setTimeout(() => {
            if (!keepRecognitionAliveRef.current || recognitionRef.current !== recognition) return
            try {
              recognition.start()
            } catch {
              setError('No se pudo mantener la escucha activa.')
            }
          }, 180)
        }

        recognitionRef.current = recognition
        recognition.start()
        setUsingLiveRecognition(true)
      } else {
        const mimeType = getRecorderMimeType()
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
        chunksRef.current = []
        recorderRef.current = recorder

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunksRef.current.push(event.data)
        }
        recorder.start(250)
        setUsingLiveRecognition(false)
      }
      setListening(true)
    } catch (err: any) {
      setError('No se pudo abrir el microfono.')
      cleanupAudio()
      setSupported(!!navigator.mediaDevices?.getUserMedia && (!!window.MediaRecorder || !!getSpeechRecognitionCtor()))
      setListening(false)
      setUsingLiveRecognition(false)
    }
  }, [cleanupAudio, preferLiveRecognition, resetTranscript, supported])

  useEffect(() => () => {
    void stopListening(true)
  }, [stopListening])

  return {
    listening,
    supported,
    bars,
    volume,
    transcript,
    interimTranscript,
    usingLiveRecognition,
    error,
    startListening,
    stopListening,
    resetTranscript,
  }
}

function VoiceBars({ bars, compact = false }: { bars: number[], compact?: boolean }) {
  return (
    <div className={`voice-bars ${compact ? 'compact' : ''}`}>
      {bars.map((height, i) => (
        <span
          key={i}
          style={{ height: `${height}%`, opacity: 0.36 + (height / 100) * 0.64 }}
        />
      ))}
    </div>
  )
}

function DictationControl({
  onApply,
  disabled,
}: {
  onApply: (text: string) => void
  disabled: boolean
}) {
  const voice = useKodexVoice()
  const [transcribing, setTranscribing] = useState(false)
  const [dictationError, setDictationError] = useState('')

  if (!voice.supported) return null

  if (voice.listening || transcribing) {
    return (
      <div className="dictation-panel">
        {transcribing ? (
          <span className="voice-transcribing-label">Transcribiendo...</span>
        ) : (
          <VoiceBars bars={voice.bars} />
        )}
        <button
          type="button"
          className="voice-icon-btn"
          onClick={async () => {
            await voice.stopListening(true)
            setTranscribing(false)
            setDictationError('')
          }}
          title="Cancelar dictado"
        >
          <X className="w-4 h-4" />
        </button>
        <button
          type="button"
          className="voice-icon-btn confirm"
          disabled={transcribing}
          onClick={async () => {
            setTranscribing(true)
            setDictationError('')
            try {
              const blob = await voice.stopListening(false)
              const text = blob ? await transcribeAudioBlob(blob) : ''
              if (text) onApply(text)
            } catch (error: any) {
              setDictationError(error?.message || 'No se pudo transcribir.')
            } finally {
              voice.resetTranscript()
              setTranscribing(false)
            }
          }}
          title="Usar transcripcion"
        >
          <Check className="w-4 h-4" />
        </button>
        {dictationError && <span className="voice-error-inline">{dictationError}</span>}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDictationError('')
        voice.startListening()
      }}
      disabled={disabled}
      title="Dictar mensaje"
      className="input-action-btn"
    >
      <Mic className="w-4 h-4" />
    </button>
  )
}

function VoiceConversationControl({
  active,
  supported,
  bars,
  disabled,
  onStart,
  onFinish,
}: {
  active: boolean
  supported: boolean
  bars: number[]
  disabled: boolean
  onStart: () => void
  onFinish: () => void
}) {
  if (!supported) return null

  if (active) {
    return (
      <button
        type="button"
        onClick={onFinish}
        className="voice-chat-finish"
        title="Finalizar chat de voz"
      >
        <VoiceBars bars={bars} compact />
        <span>Finalizar</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onStart}
      disabled={disabled}
      className="voice-chat-btn"
      title="Conversar por voz"
    >
      <AudioLines className="w-4 h-4" />
    </button>
  )
}

function VoiceStatusBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="voice-status-bubble">{text}</div>
    </div>
  )
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
// ── Parse user content ───────────────────────────────────────────
function parseUserContent(content: string) {
  const fileRegex = /\[Archivo adjunto: (.+?)\]\n```[\s\S]*?```/g
  const fileNames: string[] = []
  let match
  while ((match = fileRegex.exec(content)) !== null) {
    fileNames.push(match[1])
  }
  const cleanText = content.replace(/\[Archivo adjunto: .+?\]\n```[\s\S]*?```/g, '').trim()
  return { cleanText, fileNames }
}
// ── Message bubble ───────────────────────────────────────────────
function MessageBubble({
  message, isStreaming, isLoading, onFeedback, onEdit, onRegenerate,
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
  const [copied, setCopied] = useState(false)
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
    if (trimmed && trimmed !== message.content) onEdit(message.id, trimmed)
    setEditing(false)
  }

  const handleCancelEdit = () => {
    setEditText(message.content)
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleConfirmEdit() }
    if (e.key === 'Escape') handleCancelEdit()
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className={`flex gap-3 items-start group ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isUser && (
        <div className="assistant-avatar flex-shrink-0">
          <Bot className="w-3.5 h-3.5 text-white" />
        </div>
      )}
      <div className={`message-content flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
        {isUser && editing ? (
          <div className="message-edit-panel">
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
                background: '#0D1B3E', color: '#f1f5f9',
                borderRadius: '18px 18px 4px 18px',
                border: '2px solid #00C9C8', minHeight: '48px',
                width: '100%',
                wordBreak: 'break-word', whiteSpace: 'pre-wrap', lineHeight: '1.6',
              }}
              rows={Math.max(2, editText.split('\n').length)}
            />
            <div className="flex gap-2">
              <button onClick={handleCancelEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
                <X className="w-3 h-3" /> Cancelar
              </button>
              <button onClick={handleConfirmEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#0D1B3E] text-white hover:bg-[#00C9C8] transition-colors">
                <Check className="w-3 h-3" /> Enviar
              </button>
            </div>
          </div>
        ) : isUser ? (
          <div className="user-bubble">
            {(() => {
              const { cleanText, fileNames } = parseUserContent(message.content)
              return (
                <>
                  {fileNames.map((name) => (
                    <div key={name} className="message-file-chip flex items-center gap-1.5 mb-2 px-2 py-1.5 bg-white/10 rounded-lg border border-white/20">
                      <FileText className="w-3 h-3 text-[#00C9C8] flex-shrink-0" />
                      <span className="text-xs text-white/80 truncate">{name}</span>
                    </div>
                  ))}
                  {cleanText && (
                    <span className="whitespace-pre-wrap text-sm leading-relaxed">{cleanText}</span>
                  )}
                </>
              )
            })()}
          </div>
        ) : (
          <div className="assistant-bubble">
            {!message.content && isStreaming ? (
              <TypingIndicator />
            ) : (
              <div className="markdown"><ReactMarkdown>{message.content}</ReactMarkdown></div>
            )}
          </div>
        )}

        {!editing && (
          <div className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
            {isUser && !isLoading && (
              <>
                <button onClick={() => setEditing(true)} className="p-1.5 rounded-md text-gray-400 hover:text-[#0D1B3E] hover:bg-gray-100 transition-colors" title="Editar">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={handleCopy} className="p-1.5 rounded-md text-gray-400 hover:text-[#0D1B3E] hover:bg-gray-100 transition-colors" title="Copiar">
                  <Copy className="w-3.5 h-3.5" style={{ color: copied ? '#00C9C8' : undefined }} />
                </button>
                <button onClick={() => onRegenerate(message.id)} className="p-1.5 rounded-md text-gray-400 hover:text-[#0D1B3E] hover:bg-gray-100 transition-colors" title="Regenerar">
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </>
            )}
            {!isUser && !isStreaming && (
              <>
                <button onClick={handleCopy} className="p-1.5 rounded-md text-gray-400 hover:text-[#0D1B3E] hover:bg-gray-100 transition-colors" title="Copiar">
                  <Copy className="w-3.5 h-3.5" style={{ color: copied ? '#00C9C8' : undefined }} />
                </button>
                <button onClick={() => onFeedback(message.id, 'like')} className={`p-1.5 rounded-md transition-colors ${message.feedback === 'like' ? 'text-[#00C9C8] bg-[#00C9C8]/10' : 'text-gray-400 hover:text-[#00C9C8] hover:bg-gray-100'}`} title="Buena respuesta">
                  <ThumbsUp className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => onFeedback(message.id, 'dislike')} className={`p-1.5 rounded-md transition-colors ${message.feedback === 'dislike' ? 'text-red-400 bg-red-50' : 'text-gray-400 hover:text-red-400 hover:bg-gray-100'}`} title="Mala respuesta">
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
function WelcomeScreen({ onShowAuth, isLoggedIn }: { onShowAuth: () => void, isLoggedIn: boolean }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-white border border-gray-200 flex items-center justify-center mx-auto mb-4 shadow-sm">
        <Bot className="w-7 h-7 text-[#0D1B3E]" />
      </div>
      <h2 className="welcome-title">¿En qué puedo ayudarte?</h2>
      <p className="welcome-subtitle">Asistente inteligente de Kodex Tech Solutions</p>
      {!isLoggedIn && (
        <button onClick={onShowAuth} className="mt-6 px-5 py-2.5 rounded-xl bg-[#0D1B3E] text-white text-sm font-medium hover:bg-[#00C9C8] transition-colors">
          Iniciar sesión para guardar chats
        </button>
      )}
    </div>
  )
}

// ── Guest banner ─────────────────────────────────────────────────
function GuestBanner({ onShowAuth }: { onShowAuth: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-amber-50 border-b border-amber-100 text-xs text-amber-700">
      <span>Estás en modo invitado — las conversaciones no se guardan.</span>
      <button onClick={onShowAuth} className="font-semibold underline hover:text-amber-900">Iniciar sesión</button>
    </div>
  )
}

// ── File preview ─────────────────────────────────────────────────
function FilePreview({ file, onRemove }: { file: ParsedFile, onRemove: () => void }) {
  const sizeKB = (file.size / 1024).toFixed(1)
  return (
    <div className="chat-inline-panel flex items-center gap-2 px-3 py-2 bg-[#0D1B3E]/5 border border-[#0D1B3E]/10 rounded-xl mx-auto mb-2">
      <FileText className="w-4 h-4 text-[#0D1B3E] flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-[#0D1B3E] truncate">{file.name}</p>
        <p className="text-xs text-gray-400">{sizeKB} KB · {file.type.toUpperCase()}</p>
      </div>
      <button
        onClick={onRemove}
        className="p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// ── Sidebar ──────────────────────────────────────────────────────
function Sidebar({
  conversations, activeId, onSelect, onNew, onDelete, onRename, onPin,
  user, username, initials, onSignOut, onShowAuth,
  avatarUrl,
}: {
  conversations: Conversation[]
  activeId: string
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
  onPin: (id: string) => void
  user: any
  username: string
  initials: string
  avatarUrl: string | null
  onSignOut: () => void
  onShowAuth: () => void
}) {
  const [menuId, setMenuId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameText, setRenameText] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuId(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const pinned = conversations.filter((c: any) => c.pinned)
  const unpinned = conversations.filter((c: any) => !c.pinned)

  const renderItem = (c: Conversation) => (
    <div key={c.id} className="relative group/item">
      {renamingId === c.id ? (
        <div className="px-2 py-1">
          <input
            autoFocus
            value={renameText}
            onChange={(e) => setRenameText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { onRename(c.id, renameText); setRenamingId(null) }
              if (e.key === 'Escape') setRenamingId(null)
            }}
            className="w-full px-2 py-1 text-xs rounded-md bg-white/10 text-white border border-[#00C9C8]/40 focus:outline-none"
          />
        </div>
      ) : (
        <div className={`chat-history-item ${c.id === activeId ? 'active' : ''}`}>
          <div
            className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
            onClick={() => onSelect(c.id)}
          >
            {(c as any).pinned && <span className="text-[#00C9C8] text-xs">📌</span>}
            <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 opacity-50" />
            <span className="truncate flex-1 text-sm">{c.title}</span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setMenuId(menuId === c.id ? null : c.id) }}
            className="opacity-0 group-hover/item:opacity-100 p-0.5 rounded hover:bg-white/10 transition-opacity flex-shrink-0"
          >
            <span className="text-white/50 text-xs">···</span>
          </button>
        </div>
      )}
      {menuId === c.id && (
        <div ref={menuRef} className="absolute right-2 top-8 z-50 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden w-44">
          <button onClick={() => { onPin(c.id); setMenuId(null) }} className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-gray-600 hover:bg-gray-50">
            📌 {(c as any).pinned ? 'Desfijar' : 'Fijar chat'}
          </button>
          <button onClick={() => { setRenamingId(c.id); setRenameText(c.title); setMenuId(null) }} className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-gray-600 hover:bg-gray-50">
            ✏️ Cambiar nombre
          </button>
          <div className="border-t border-gray-100" />
          <button onClick={() => { onDelete(c.id); setMenuId(null) }} className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-red-500 hover:bg-red-50">
            🗑️ Eliminar
          </button>
        </div>
      )}
    </div>
  )

  return (
    <aside className="sidebar">
      <div className="px-4 py-5"><span className="sidebar-logo">KODEX IA</span></div>
      <div className="px-3 mb-4">
        <button className="sidebar-new-chat" onClick={onNew}>
          <Plus className="w-4 h-4" /> Nuevo chat
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-3">
        {pinned.length > 0 && (
          <>
            <p className="sidebar-section-title mb-2">Fijados</p>
            {pinned.map(renderItem)}
          </>
        )}
        {unpinned.length > 0 && (
          <>
            <p className="sidebar-section-title mb-2 mt-3">Recientes</p>
            {unpinned.map(renderItem)}
          </>
        )}
      </div>
      <div className="px-3 pb-3">
        {user ? (
          <UserMenu
            username={username}
            initials={initials}
            avatarUrl={avatarUrl}
            onSignOut={onSignOut}
          />
        ) : (
          <button onClick={onShowAuth} className="sidebar-new-chat">Iniciar sesión</button>
        )}
      </div>
    </aside>
  )
}

// ── Home ─────────────────────────────────────────────────────────
function Home() {
  const [input, setInput] = useState('')
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [authVerification, setAuthVerification] = useState<{
    email: string
    type: EmailVerificationType
  } | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvId, setActiveConvId] = useState<string>('')
  const [attachedFile, setAttachedFile] = useState<ParsedFile | null>(null)
  const [fileLoading, setFileLoading] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { messages, sendMessage, editAndResend, setFeedback, isLoading, stop, clearMessages, restoreMessages, setActiveConv } = useKodexChat()
  const {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    verifyEmailCode,
    resendEmailCode,
    username,
    initials,
    avatarUrl,
    appearance,
    voiceProfile,
  } = useAuth()
  useKodexAppearance(appearance)
  const { voiceProfileId } = useVoiceProfile(voiceProfile)
  const { voices: speechVoices } = useSpeechVoices()
  const bottomRef = useRef<HTMLDivElement>(null)
  const pendingSelectRef = useRef<string>('')
  const savingRef = useRef(false)
  const lastSavedRef = useRef<string[]>([])
  const activeConvIdRef = useRef('')
  const isLoadingRef = useRef(false)
  const voiceChatActiveRef = useRef(false)
  const voiceAwaitingAnswerRef = useRef(false)
  const voiceLastSpokenIdRef = useRef('')
  const voiceSubmitTimerRef = useRef<number | undefined>(undefined)
  const voiceSubmittingRef = useRef(false)
  const voiceHeardSpeechRef = useRef(false)
  const voiceLiveBufferRef = useRef('')
  const voiceSpeakingTextRef = useRef('')
  const voiceFinishAfterAnswerRef = useRef(false)
  const [voiceChatActive, setVoiceChatActive] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'listening' | 'transcribing' | 'speaking'>('idle')
  const [voiceRuntimeError, setVoiceRuntimeError] = useState('')

  const submitMessage = useCallback(async (finalText: string, titleSeed?: string) => {
    const cleanText = finalText.trim()
    if (!cleanText) return false

    if (user && !activeConvId) {
      try {
        const title = (titleSeed || cleanText || 'Chat').slice(0, 40)
        const conv = await createConversation(title)
        setActiveConvId(conv.id)
        setActiveConv(conv.id)
        setConversations((prev) => [conv, ...prev])
        const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: cleanText }
        await saveMessage(conv.id, userMsg)
        lastSavedRef.current.push(userMsg.id)
        sendMessage(cleanText, undefined, conv.id, userMsg)
      } catch (e) {
        console.error(e)
        sendMessage(cleanText)
      }
    } else if (user && activeConvId) {
      const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: cleanText }
      await saveMessage(activeConvId, userMsg)
      lastSavedRef.current.push(userMsg.id)
      sendMessage(cleanText, undefined, activeConvId, userMsg)
      if (messages.length === 0) {
        updateConversationTitle(activeConvId, cleanText.slice(0, 40))
        setConversations((prev) =>
          prev.map((c) => c.id === activeConvId ? { ...c, title: cleanText.slice(0, 40) } : c)
        )
      }
    } else {
      sendMessage(cleanText)
    }

    return true
  }, [activeConvId, messages.length, sendMessage, setActiveConv, user])

  const submitVoiceTurn = useCallback(async (text: string) => {
    const cleanText = text.trim()
    if (!cleanText || !voiceChatActiveRef.current) return

    voiceSpeakingTextRef.current = ''
    window.speechSynthesis?.cancel()
    setVoiceStatus('transcribing')

    if (isLoadingRef.current) {
      stop()
      await new Promise((resolve) => setTimeout(resolve, 80))
    }

    const sent = await submitMessage(cleanText, cleanText)
    if (sent) {
      voiceAwaitingAnswerRef.current = true
      setVoiceStatus('speaking')
    }
  }, [stop, submitMessage])

  const isLikelyAssistantEcho = useCallback((text: string) => {
    const spoken = voiceSpeakingTextRef.current
    if (!spoken) return false

    const cleanHeard = textForSpeech(text).toLowerCase()
    const cleanSpoken = textForSpeech(spoken).toLowerCase()
    if (cleanHeard.length < 14 || cleanSpoken.length < 14) return false

    return cleanSpoken.includes(cleanHeard) || cleanHeard.includes(cleanSpoken.slice(0, Math.min(60, cleanSpoken.length)))
  }, [])

  const handleLiveVoiceInterim = useCallback((text: string) => {
    if (!voiceChatActiveRef.current || !text.trim() || isLikelyAssistantEcho(text)) return
    setVoiceRuntimeError('')
    window.speechSynthesis?.cancel()
    setVoiceStatus('listening')
  }, [isLikelyAssistantEcho])

  const handleLiveVoiceFinal = useCallback((text: string) => {
    const cleanText = text.trim()
    if (!voiceChatActiveRef.current || !cleanText || isLikelyAssistantEcho(cleanText)) return

    voiceHeardSpeechRef.current = true
    voiceFinishAfterAnswerRef.current = false
    voiceLiveBufferRef.current = voiceLiveBufferRef.current
      ? `${voiceLiveBufferRef.current} ${cleanText}`
      : cleanText

    window.clearTimeout(voiceSubmitTimerRef.current)
    voiceSubmitTimerRef.current = window.setTimeout(() => {
      const bufferedText = voiceLiveBufferRef.current.trim()
      voiceLiveBufferRef.current = ''
      if (bufferedText) void submitVoiceTurn(bufferedText)
    }, 650)
  }, [isLikelyAssistantEcho, submitVoiceTurn])

  const voiceChat = useKodexVoice({
    onFinalText: handleLiveVoiceFinal,
    onInterimText: handleLiveVoiceInterim,
    preferLiveRecognition: true,
  })

  const processVoiceRecording = useCallback(async () => {
    if (voiceSubmittingRef.current) return

    window.clearTimeout(voiceSubmitTimerRef.current)
    voiceSubmitTimerRef.current = undefined
    voiceSubmittingRef.current = true
    voiceHeardSpeechRef.current = false
    setVoiceRuntimeError('')
    setVoiceStatus('transcribing')

    try {
      const blob = await voiceChat.stopListening(false)
      const text = blob ? await transcribeAudioBlob(blob) : ''

      if (text) {
        await submitVoiceTurn(text)
        return
      }

      if (voiceChatActiveRef.current) {
        setVoiceStatus('listening')
        await voiceChat.startListening()
      }
    } catch (error: any) {
      console.error('Voice transcription error:', error)
      setVoiceRuntimeError(error?.message || 'No se pudo transcribir el audio.')
      if (voiceChatActiveRef.current) {
        setVoiceStatus('listening')
        await voiceChat.startListening()
      }
    } finally {
      window.setTimeout(() => {
        voiceSubmittingRef.current = false
      }, 350)
    }
  }, [submitVoiceTurn, voiceChat])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  useEffect(() => {
    isLoadingRef.current = isLoading
  }, [isLoading])

  useEffect(() => {
    voiceChatActiveRef.current = voiceChatActive
  }, [voiceChatActive])

  useEffect(() => {
    if (!voiceChatActive || voiceChat.usingLiveRecognition || !voiceChat.listening || voiceSubmittingRef.current) return

    const speakingNow = voiceChat.volume > 0.025
    if (speakingNow) {
      voiceHeardSpeechRef.current = true
      window.clearTimeout(voiceSubmitTimerRef.current)
      voiceSubmitTimerRef.current = undefined
      setVoiceRuntimeError('')
      setVoiceStatus('listening')
      return
    }

    if (!voiceHeardSpeechRef.current || voiceSubmitTimerRef.current) return

    voiceSubmitTimerRef.current = window.setTimeout(() => {
      processVoiceRecording()
    }, 900)
  }, [processVoiceRecording, voiceChat.listening, voiceChat.usingLiveRecognition, voiceChat.volume, voiceChatActive])

  useEffect(() => {
    if (!voiceChatActive || isLoading || !voiceAwaitingAnswerRef.current) return

    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant' && m.content.trim())
    if (!lastAssistant || lastAssistant.id === voiceLastSpokenIdRef.current) return

    voiceAwaitingAnswerRef.current = false
    voiceLastSpokenIdRef.current = lastAssistant.id
    setVoiceStatus('speaking')
    voiceSpeakingTextRef.current = textForSpeech(lastAssistant.content)
    speakWithVoiceProfile(lastAssistant.content, voiceProfileId, speechVoices, async () => {
      voiceSpeakingTextRef.current = ''
      if (voiceFinishAfterAnswerRef.current) {
        voiceFinishAfterAnswerRef.current = false
        setVoiceChatActive(false)
        voiceChatActiveRef.current = false
        voiceSubmittingRef.current = false
        voiceHeardSpeechRef.current = false
        voiceLiveBufferRef.current = ''
        setVoiceStatus('idle')
        voiceChat.resetTranscript()
        return
      }

      if (voiceChatActiveRef.current) {
        setVoiceStatus('listening')
        await voiceChat.startListening()
      } else {
        setVoiceStatus('idle')
      }
    })
  }, [isLoading, messages, speechVoices, voiceChat, voiceChatActive, voiceProfileId])

  useEffect(() => () => {
    window.clearTimeout(voiceSubmitTimerRef.current)
    voiceLiveBufferRef.current = ''
    voiceSpeakingTextRef.current = ''
    voiceFinishAfterAnswerRef.current = false
    window.speechSynthesis?.cancel()
  }, [])

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const authAction = searchParams.get('auth')
    const type = searchParams.get('type')
    const emailParam = searchParams.get('email')

    if (authAction !== 'verify' || type !== 'signup' || !emailParam) return

    setAuthVerification({ email: emailParam, type: 'signup' })
    setShowAuth(true)
    window.history.replaceState({}, '', window.location.pathname)
  }, [])

  useEffect(() => {
    if (user) {
      loadConversations().then(setConversations).catch(console.error)
    } else {
      setConversations([])
      setActiveConvId('')
    }
  }, [user])
  useEffect(() => {
    activeConvIdRef.current = activeConvId
  }, [activeConvId])

  useEffect(() => {
    const convId = activeConvIdRef.current
    if (!user || !convId || messages.length === 0 || isLoading) return
    const unsaved = messages.filter(
      (m) => m.content && !lastSavedRef.current.includes(m.id)
    )
    if (unsaved.length === 0) return
    unsaved.forEach(async (m) => {
      await saveMessage(convId, m)
      lastSavedRef.current.push(m.id)
    })
  }, [messages, isLoading, user])

  // ── Manejo de archivos ────────────────────────────────────────
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setFileError(null)
    setFileLoading(true)
    try {
      const parsed = await parseFile(file)
      setAttachedFile(parsed)
    } catch (err: any) {
      setFileError(err.message || 'Error al procesar el archivo')
    } finally {
      setFileLoading(false)
    }
  }, [])

  const handleRemoveFile = useCallback(() => {
    setAttachedFile(null)
    setFileError(null)
  }, [])

  const handleNew = useCallback(() => {
    window.clearTimeout(voiceSubmitTimerRef.current)
    voiceSubmittingRef.current = false
    voiceLiveBufferRef.current = ''
    voiceSpeakingTextRef.current = ''
    voiceFinishAfterAnswerRef.current = false
    voiceChat.stopListening(true)
    window.speechSynthesis?.cancel()
    setVoiceChatActive(false)
    voiceChatActiveRef.current = false
    voiceAwaitingAnswerRef.current = false
    setVoiceStatus('idle')
    setActiveConvId('')
    setActiveConv('')
    clearMessages()
    setInput('')
    setAttachedFile(null)
    setFileError(null)
    lastSavedRef.current = []
  }, [clearMessages, setActiveConv, voiceChat])

  const handleSelect = useCallback(async (id: string) => {
    if (id === activeConvId) return
    window.clearTimeout(voiceSubmitTimerRef.current)
    voiceSubmittingRef.current = false
    voiceLiveBufferRef.current = ''
    voiceSpeakingTextRef.current = ''
    voiceFinishAfterAnswerRef.current = false
    voiceChat.stopListening(true)
    window.speechSynthesis?.cancel()
    setVoiceChatActive(false)
    voiceChatActiveRef.current = false
    voiceAwaitingAnswerRef.current = false
    setVoiceStatus('idle')
    pendingSelectRef.current = id
    setActiveConvId(id)
    setActiveConv(id)
    lastSavedRef.current = []
    try {
      const msgs = await loadMessages(id)
      if (pendingSelectRef.current !== id) return // respuesta vieja, ignorar
      restoreMessages(msgs, id)
    } catch (e) { console.error(e) }
  }, [activeConvId, restoreMessages, setActiveConv, voiceChat])

  const handleSubmit = useCallback(async () => {
    const text = input.trim()
    if ((!text && !attachedFile) || isLoading) return

    // Construir mensaje final con archivo si hay uno adjunto
    let finalText = text
    if (attachedFile) {
      const fileContent = formatFileForPrompt(attachedFile)
      finalText = text ? `${text}\n\n${fileContent}` : fileContent
    }

    setAttachedFile(null)
    setFileError(null)

    const sent = await submitMessage(finalText, text || attachedFile?.name || 'Archivo')
    if (sent) setInput('')
  }, [input, attachedFile, isLoading, submitMessage])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
  }

  const startVoiceChat = useCallback(() => {
    window.clearTimeout(voiceSubmitTimerRef.current)
    voiceSubmitTimerRef.current = undefined
    voiceSubmittingRef.current = false
    voiceHeardSpeechRef.current = false
    voiceLiveBufferRef.current = ''
    voiceSpeakingTextRef.current = ''
    voiceFinishAfterAnswerRef.current = false
    setVoiceRuntimeError('')
    voiceChat.resetTranscript()
    setVoiceChatActive(true)
    voiceChatActiveRef.current = true
    setVoiceStatus('listening')
    voiceChat.startListening()
  }, [voiceChat])

  const finishVoiceChat = useCallback(async () => {
    window.clearTimeout(voiceSubmitTimerRef.current)
    voiceSubmitTimerRef.current = undefined
    const pendingLiveText = voiceLiveBufferRef.current.trim()
    voiceLiveBufferRef.current = ''
    const pendingBlob = await voiceChat.stopListening(false)
    let submittedPendingTurn = false

    if (pendingLiveText) {
      voiceFinishAfterAnswerRef.current = true
      await submitVoiceTurn(pendingLiveText)
      submittedPendingTurn = true
    } else if (pendingBlob && pendingBlob.size > 800 && voiceHeardSpeechRef.current) {
      try {
        setVoiceStatus('transcribing')
        const text = await transcribeAudioBlob(pendingBlob)
        if (text) {
          voiceFinishAfterAnswerRef.current = true
          await submitVoiceTurn(text)
          submittedPendingTurn = true
        }
      } catch (error: any) {
        console.error('Voice finish transcription error:', error)
        setVoiceRuntimeError(error?.message || 'No se pudo transcribir el audio.')
      }
    }

    if (submittedPendingTurn) return

    setVoiceChatActive(false)
    voiceChatActiveRef.current = false
    voiceAwaitingAnswerRef.current = false
    voiceSubmittingRef.current = false
    voiceHeardSpeechRef.current = false
    voiceSpeakingTextRef.current = ''
    voiceFinishAfterAnswerRef.current = false
    setVoiceStatus('idle')
    voiceChat.resetTranscript()
    window.speechSynthesis?.cancel()
  }, [submitVoiceTurn, voiceChat])

  const handleEdit = (id: string, newText: string) => editAndResend(id, newText)

  const handleRegenerate = (id: string) => {
    const idx = messages.findIndex((m) => m.id === id)
    if (idx === -1) return
    const msg = messages[idx]
    if (msg.role === 'user') {
      sendMessage(msg.content, messages.slice(0, idx))
    } else {
      const userMsg = messages.slice(0, idx).reverse().find((m) => m.role === 'user')
      if (!userMsg) return
      const userIdx = messages.findIndex((m) => m.id === userMsg.id)
      sendMessage(userMsg.content, messages.slice(0, userIdx))
    }
  }

  const handleFeedback = useCallback((id: string, feedback: 'like' | 'dislike') => {
    setFeedback(id, feedback)
    if (user && activeConvId) {
      const msg = messages.find((m) => m.id === id)
      const newFeedback = msg?.feedback === feedback ? null : feedback
      updateMessageFeedback(id, newFeedback)
    }
  }, [setFeedback, user, activeConvId, messages])

  const handleSignOut = async () => {
    window.clearTimeout(voiceSubmitTimerRef.current)
    voiceSubmittingRef.current = false
    voiceLiveBufferRef.current = ''
    voiceSpeakingTextRef.current = ''
    voiceFinishAfterAnswerRef.current = false
    voiceChat.stopListening(true)
    window.speechSynthesis?.cancel()
    setVoiceChatActive(false)
    voiceChatActiveRef.current = false
    voiceAwaitingAnswerRef.current = false
    setVoiceStatus('idle')
    await signOut()
    clearMessages()
    setActiveConvId('')
    lastSavedRef.current = []
  }

  const handleDelete = useCallback((id: string) => {
    deleteConversation(id)
    setConversations((prev) => prev.filter((c) => c.id !== id))
    if (id === activeConvId) handleNew()
  }, [activeConvId, handleNew])

  const handleRename = useCallback((id: string, title: string) => {
    if (!title.trim()) return
    updateConversationTitle(id, title.trim())
    setConversations((prev) =>
      prev.map((c) => c.id === id ? { ...c, title: title.trim() } : c)
    )
  }, [])

  const handlePin = useCallback((id: string) => {
    setConversations((prev) =>
      prev.map((c) => c.id === id ? { ...c, pinned: !(c as any).pinned } : c)
    )
  }, [])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f7f7f5]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0D1B3E] flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <p className="text-sm text-gray-400">Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`app-shell ${mobileSidebarOpen ? 'sidebar-open' : ''}`}>
      {showAuth && (
        <AuthModal
          initialVerification={authVerification}
          onClose={() => {
            setShowAuth(false)
            setAuthVerification(null)
          }}
          onResendEmailCode={resendEmailCode}
          onSignIn={signIn}
          onSignUp={signUp}
          onVerifyEmailCode={verifyEmailCode}
        />
      )}
      <Sidebar
        conversations={conversations}
        activeId={activeConvId}
        onSelect={(id) => {
          setMobileSidebarOpen(false)
          void handleSelect(id)
        }}
        onNew={() => {
          setMobileSidebarOpen(false)
          handleNew()
        }}
        onDelete={handleDelete}
        onRename={handleRename}
        onPin={handlePin}
        user={user}
        username={username}
        initials={initials}
        avatarUrl={avatarUrl}
        onSignOut={() => {
          setMobileSidebarOpen(false)
          void handleSignOut()
        }}
        onShowAuth={() => {
          setMobileSidebarOpen(false)
          setShowAuth(true)
        }}
      />
      {mobileSidebarOpen && (
        <button
          type="button"
          className="mobile-sidebar-backdrop"
          onClick={() => setMobileSidebarOpen(false)}
          aria-label="Cerrar menu"
        />
      )}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="main-header">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              className="mobile-menu-btn"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold text-[#0D1B3E] truncate">KODEX IA</span>
          </div>
          <span className="header-model-badge">mistral-small</span>
        </header>
        {!user && <GuestBanner onShowAuth={() => setShowAuth(true)} />}
        <div className="chat-area flex flex-col flex-1 min-h-0 overflow-y-auto">
          {messages.length === 0 && !voiceChatActive ? (
            <WelcomeScreen onShowAuth={() => setShowAuth(true)} isLoggedIn={!!user} />
          ) : (
            <div className="messages-container">
              {messages.map((msg, i) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isStreaming={isLoading && i === messages.length - 1}
                  isLoading={isLoading}
                  onFeedback={handleFeedback}
                  onEdit={handleEdit}
                  onRegenerate={handleRegenerate}
                />
              ))}
              {voiceChatActive && (
                <VoiceStatusBubble
                  text={
                    voiceRuntimeError || voiceChat.error || (
                      voiceStatus === 'speaking'
                        ? 'Respondiendo por voz...'
                        : voiceStatus === 'transcribing'
                          ? 'Procesando tu voz...'
                          : voiceChat.interimTranscript
                            ? `Escuchando: ${voiceChat.interimTranscript.slice(0, 80)}`
                            : 'Escuchando...'
                    )
                  }
                />
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
        <div className="input-area">
          {isLoading && (
            <div className="chat-inline-panel flex justify-center mb-3 mx-auto">
              <button onClick={stop} className="stop-btn">
                <Square className="w-3 h-3 fill-current" /> Detener generación
              </button>
            </div>
          )}

          {/* Preview del archivo adjunto */}
          {attachedFile && (
            <FilePreview file={attachedFile} onRemove={handleRemoveFile} />
          )}

          {/* Error de archivo */}
          {fileError && (
            <div className="chat-inline-panel mx-auto mb-2 px-3 py-2 bg-red-50 border border-red-100 rounded-xl text-xs text-red-500 flex items-center justify-between">
              <span>{fileError}</span>
              <button onClick={() => setFileError(null)} className="ml-2 hover:text-red-700">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Loading de archivo */}
          {fileLoading && (
            <div className="chat-inline-panel mx-auto mb-2 px-3 py-2 bg-[#0D1B3E]/5 border border-[#0D1B3E]/10 rounded-xl text-xs text-[#0D1B3E] flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-[#00C9C8] border-t-transparent rounded-full animate-spin" />
              Procesando archivo...
            </div>
          )}

          <div className="input-wrapper">
            {/* Input oculto para archivos */}
            <input
              ref={fileInputRef}
              type="file"
              accept={getSupportedExtensions()}
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Botón clip */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || fileLoading}
              className="input-action-btn"
              title="Adjuntar archivo"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            {/* Botón de voz */}
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={attachedFile ? 'Pregunta algo sobre el archivo...' : 'Escribe un mensaje...'}
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
            <DictationControl
              onApply={(text) => setInput((prev) => prev ? `${prev} ${text}` : text)}
              disabled={isLoading || fileLoading || voiceChatActive}
            />
            <VoiceConversationControl
              active={voiceChatActive}
              supported={voiceChat.supported}
              bars={voiceChat.bars}
              disabled={fileLoading}
              onStart={startVoiceChat}
              onFinish={finishVoiceChat}
            />
            <button
              onClick={handleSubmit}
              disabled={(!input.trim() && !attachedFile) || isLoading || fileLoading}
              className="send-btn"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="input-disclaimer">KODEX IA puede cometer errores. Verificá las respuestas importantes.</p>
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/')({
  component: Home,
})
