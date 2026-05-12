import { useCallback, useEffect, useState } from 'react'

export type VoiceProfileId = 'aurora' | 'lucia' | 'valeria' | 'atlas' | 'mateo' | 'orion'

export type VoiceProfile = {
  id: VoiceProfileId
  name: string
  label: string
  description: string
  lang: string
  gender: 'female' | 'male'
  rate: number
  pitch: number
  keywords: string[]
}

export const VOICE_STORAGE_KEY = 'kodex-voice-profile'

export const VOICE_PROFILES: VoiceProfile[] = [
  {
    id: 'aurora',
    name: 'Aurora',
    label: 'Femenina clara',
    description: 'Suave, natural y precisa para respuestas largas.',
    lang: 'es-ES',
    gender: 'female',
    rate: 1,
    pitch: 1.04,
    keywords: ['sabina', 'helena', 'elvira', 'female', 'mujer', 'google espanol'],
  },
  {
    id: 'lucia',
    name: 'Lucia',
    label: 'Femenina calida',
    description: 'Cercana y tranquila para conversaciones diarias.',
    lang: 'es-MX',
    gender: 'female',
    rate: 0.96,
    pitch: 1.08,
    keywords: ['paulina', 'dalia', 'sabina', 'female', 'mujer', 'latinoamerica'],
  },
  {
    id: 'valeria',
    name: 'Valeria',
    label: 'Femenina agil',
    description: 'Mas dinamica, buena para explicaciones cortas.',
    lang: 'es-US',
    gender: 'female',
    rate: 1.05,
    pitch: 1.1,
    keywords: ['paloma', 'sabina', 'female', 'mujer', 'spanish'],
  },
  {
    id: 'atlas',
    name: 'Atlas',
    label: 'Masculina ejecutiva',
    description: 'Sobria, firme y profesional.',
    lang: 'es-ES',
    gender: 'male',
    rate: 0.98,
    pitch: 0.9,
    keywords: ['pablo', 'jorge', 'male', 'hombre', 'google espanol'],
  },
  {
    id: 'mateo',
    name: 'Mateo',
    label: 'Masculina cercana',
    description: 'Natural y conversacional, con tono relajado.',
    lang: 'es-MX',
    gender: 'male',
    rate: 1,
    pitch: 0.94,
    keywords: ['raul', 'jorge', 'miguel', 'male', 'hombre', 'latinoamerica'],
  },
  {
    id: 'orion',
    name: 'Orion',
    label: 'Masculina tecnica',
    description: 'Grave y estable para respuestas tecnicas.',
    lang: 'es-US',
    gender: 'male',
    rate: 0.94,
    pitch: 0.86,
    keywords: ['miguel', 'pablo', 'jorge', 'male', 'hombre', 'spanish'],
  },
]

export function normalizeVoiceProfile(value: unknown): VoiceProfileId {
  return VOICE_PROFILES.some((profile) => profile.id === value) ? value as VoiceProfileId : 'aurora'
}

export function getVoiceProfile(profileId: unknown): VoiceProfile {
  const normalized = normalizeVoiceProfile(profileId)
  return VOICE_PROFILES.find((profile) => profile.id === normalized) ?? VOICE_PROFILES[0]
}

export function readStoredVoiceProfile(): VoiceProfileId {
  if (typeof window === 'undefined') return 'aurora'
  return normalizeVoiceProfile(window.localStorage.getItem(VOICE_STORAGE_KEY))
}

export function saveStoredVoiceProfile(profileId: VoiceProfileId) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(VOICE_STORAGE_KEY, profileId)
}

export function textForSpeech(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#*_>`~[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function baseLanguage(lang: string) {
  return lang.split('-')[0]?.toLowerCase() ?? lang.toLowerCase()
}

function scoreVoice(voice: SpeechSynthesisVoice, profile: VoiceProfile) {
  const voiceName = `${voice.name} ${voice.voiceURI}`.toLowerCase()
  const voiceLang = voice.lang.toLowerCase()
  let score = 0

  if (voiceLang === profile.lang.toLowerCase()) score += 60
  else if (baseLanguage(voiceLang) === baseLanguage(profile.lang)) score += 36

  for (const keyword of profile.keywords) {
    if (voiceName.includes(keyword.toLowerCase())) score += 12
  }

  if (profile.gender === 'female' && /(female|mujer|sabina|helena|elvira|paulina|dalia|paloma)/i.test(voiceName)) score += 20
  if (profile.gender === 'male' && /(male|hombre|pablo|jorge|raul|miguel)/i.test(voiceName)) score += 20
  if (voice.localService) score += 4
  if (/natural|online|neural|google|microsoft/i.test(voiceName)) score += 6

  return score
}

export function chooseSpeechVoice(voices: SpeechSynthesisVoice[], profileId: unknown) {
  const profile = getVoiceProfile(profileId)
  const spanishVoices = voices.filter((voice) => baseLanguage(voice.lang) === 'es')
  const candidates = spanishVoices.length ? spanishVoices : voices

  return candidates
    .slice()
    .sort((a, b) => scoreVoice(b, profile) - scoreVoice(a, profile))[0] ?? null
}

export function getResolvedSpeechVoiceName(voices: SpeechSynthesisVoice[], profileId: unknown) {
  return chooseSpeechVoice(voices, profileId)?.name ?? 'Voz del navegador'
}

export function useSpeechVoices() {
  const [supported, setSupported] = useState(false)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setSupported(false)
      return
    }

    setSupported(true)
    const loadVoices = () => setVoices(window.speechSynthesis.getVoices())
    loadVoices()
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices)

    const retry = window.setTimeout(loadVoices, 350)
    return () => {
      window.clearTimeout(retry)
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices)
    }
  }, [])

  return { supported, voices }
}

export function useVoiceProfile(userVoiceProfile?: unknown) {
  const [voiceProfileId, setVoiceProfileIdState] = useState<VoiceProfileId>(() =>
    normalizeVoiceProfile(userVoiceProfile ?? readStoredVoiceProfile()),
  )

  useEffect(() => {
    if (userVoiceProfile === undefined || userVoiceProfile === null) return
    const normalized = normalizeVoiceProfile(userVoiceProfile)
    setVoiceProfileIdState(normalized)
    saveStoredVoiceProfile(normalized)
  }, [userVoiceProfile])

  const setVoiceProfileId = useCallback((next: VoiceProfileId) => {
    const normalized = normalizeVoiceProfile(next)
    setVoiceProfileIdState(normalized)
    saveStoredVoiceProfile(normalized)
  }, [])

  return {
    voiceProfileId,
    voiceProfile: getVoiceProfile(voiceProfileId),
    setVoiceProfileId,
  }
}

export function speakWithVoiceProfile(
  text: string,
  profileId: unknown,
  voices: SpeechSynthesisVoice[],
  onDone: () => void,
) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onDone()
    return
  }

  const spokenText = textForSpeech(text)
  if (!spokenText) {
    onDone()
    return
  }

  const profile = getVoiceProfile(profileId)
  window.speechSynthesis.cancel()

  const utterance = new SpeechSynthesisUtterance(spokenText)
  const selectedVoice = chooseSpeechVoice(voices.length ? voices : window.speechSynthesis.getVoices(), profile.id)
  if (selectedVoice) {
    utterance.voice = selectedVoice
    utterance.lang = selectedVoice.lang || profile.lang
  } else {
    utterance.lang = profile.lang
  }
  utterance.rate = profile.rate
  utterance.pitch = profile.pitch
  utterance.onend = onDone
  utterance.onerror = onDone
  window.speechSynthesis.speak(utterance)
}
