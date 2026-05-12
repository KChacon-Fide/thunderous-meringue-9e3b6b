import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Bot, Check, Play, Settings, Volume2 } from 'lucide-react'

import { useKodexAppearance } from '@/lib/appearance'
import { useAuth } from '@/lib/auth-hook'
import {
  VOICE_PROFILES,
  getResolvedSpeechVoiceName,
  saveStoredVoiceProfile,
  speakWithVoiceProfile,
  useSpeechVoices,
  useVoiceProfile,
  type VoiceProfileId,
} from '@/lib/voice-settings'

const PREVIEW_TEXT = 'Hola, soy KODEX IA. Esta es una prueba de voz para tus conversaciones.'

function LoadingSettings() {
  return (
    <div className="min-h-screen bg-[#F5F7FA] dark:bg-[#080f20] flex items-center justify-center px-4">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#0D1B3E] flex items-center justify-center">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <p className="text-sm text-gray-400">Cargando configuracion...</p>
      </div>
    </div>
  )
}

function SettingsPage() {
  const navigate = useNavigate()
  const {
    appearance,
    loading,
    updateVoiceProfile,
    user,
    voiceProfile: savedVoiceProfile,
  } = useAuth()
  useKodexAppearance(appearance)

  const { supported, voices } = useSpeechVoices()
  const { voiceProfileId, setVoiceProfileId } = useVoiceProfile(savedVoiceProfile)
  const [savingVoice, setSavingVoice] = useState(false)
  const [playingVoice, setPlayingVoice] = useState<VoiceProfileId | null>(null)
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (loading) return
    if (!user) navigate({ to: '/' })
  }, [loading, navigate, user])

  useEffect(() => () => {
    window.speechSynthesis?.cancel()
  }, [])

  if (loading || !user) return <LoadingSettings />

  const handleChooseVoice = async (profileId: VoiceProfileId) => {
    setStatus('')
    setSavingVoice(true)
    try {
      setVoiceProfileId(profileId)
      saveStoredVoiceProfile(profileId)
      await updateVoiceProfile(profileId)
      setStatus('Voz guardada.')
    } catch (error: any) {
      setStatus(error?.message || 'No se pudo guardar la voz.')
    } finally {
      setSavingVoice(false)
    }
  }

  const handlePreviewVoice = (profileId: VoiceProfileId) => {
    setStatus('')
    setPlayingVoice(profileId)
    speakWithVoiceProfile(PREVIEW_TEXT, profileId, voices, () => {
      setPlayingVoice(null)
    })
  }

  return (
    <div className="settings-page min-h-screen bg-[#F5F7FA] dark:bg-[#080f20] px-4 py-6">
      <div className="settings-shell max-w-4xl mx-auto flex flex-col gap-5">
        <header className="settings-header flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => navigate({ to: '/' })}
            className="w-10 h-10 rounded-xl bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 flex items-center justify-center text-[#0D1B3E] dark:text-white hover:border-[#00C9C8]/40 transition-colors"
            aria-label="Volver"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[#00C9C8] uppercase tracking-wide">KODEX IA</p>
            <h1 className="text-2xl font-bold text-[#0D1B3E] dark:text-white">Configuracion</h1>
          </div>
          <div className="settings-header-icon w-10 h-10 rounded-xl bg-[#0D1B3E] flex items-center justify-center">
            <Settings className="w-5 h-5 text-[#00C9C8]" />
          </div>
        </header>

        <section className="settings-section bg-white dark:bg-white/[0.04] rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm overflow-hidden">
          <div className="settings-section-header px-6 py-4 border-b border-gray-50 dark:border-white/10 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0D1B3E] flex items-center justify-center">
              <Volume2 className="w-4 h-4 text-[#00C9C8]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#0D1B3E] dark:text-white">Voz de respuesta</h2>
              <p className="text-xs text-gray-400">Se aplica en chats nuevos y existentes.</p>
            </div>
          </div>

          <div className="settings-section-body px-6 py-5 flex flex-col gap-4">
            {!supported && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                Tu navegador no expone voces de lectura. El chat seguira funcionando con texto.
              </div>
            )}

            <div className="voice-profile-grid grid grid-cols-1 md:grid-cols-2 gap-3">
              {VOICE_PROFILES.map((profile) => {
                const selected = voiceProfileId === profile.id
                const engineName = getResolvedSpeechVoiceName(voices, profile.id)

                return (
                  <div
                    key={profile.id}
                    className={`rounded-2xl border p-4 transition-all ${
                      selected
                        ? 'border-[#00C9C8] bg-[#00C9C8]/5'
                        : 'border-gray-100 dark:border-white/10 bg-white dark:bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-[#0D1B3E] dark:text-white">{profile.name}</h3>
                        <p className="text-xs text-[#00C9C8] mt-0.5">{profile.label}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 leading-5">{profile.description}</p>
                        <p className="text-[11px] text-gray-400 mt-2 truncate">Motor: {engineName}</p>
                      </div>
                      {selected && (
                        <span className="w-7 h-7 rounded-full bg-[#00C9C8] flex items-center justify-center flex-shrink-0">
                          <Check className="w-4 h-4 text-[#0D1B3E]" />
                        </span>
                      )}
                    </div>

                    <div className="voice-profile-actions flex justify-end gap-2 mt-4">
                      <button
                        type="button"
                        onClick={() => handlePreviewVoice(profile.id)}
                        disabled={!supported || playingVoice !== null}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-xs font-medium text-gray-600 dark:text-gray-200 hover:border-[#00C9C8]/50 disabled:opacity-50 transition-colors"
                      >
                        <Play className="w-3.5 h-3.5" />
                        {playingVoice === profile.id ? 'Probando...' : 'Probar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleChooseVoice(profile.id)}
                        disabled={savingVoice || selected}
                        className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                          selected
                            ? 'bg-[#00C9C8]/15 text-[#00A6A5]'
                            : 'bg-[#0D1B3E] text-white hover:bg-[#00C9C8] hover:text-[#0D1B3E]'
                        } disabled:opacity-60`}
                      >
                        {selected ? 'Elegida' : 'Elegir'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {status && (
              <p className={`text-xs ${status.includes('No se pudo') ? 'text-red-500' : 'text-green-600'}`}>
                {status}
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})
