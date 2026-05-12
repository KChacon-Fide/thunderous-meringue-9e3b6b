import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { User } from '@supabase/supabase-js'
import type { AppearanceMode } from './appearance'
import type { VoiceProfileId } from './voice-settings'
import { normalizeVoiceProfile } from './voice-settings'
import {
  requestEmailChangeCode,
  requestSignupCode,
  requestVerificationCode,
  verifyEmailChangeCode,
  verifySignupCode,
} from './email-verification-client'

export type EmailVerificationType = 'signup' | 'email_change'

type PreparedAvatar = {
  file: File
  extension: 'jpg' | 'png' | 'webp'
}

function getAvatarExtension(type: string): PreparedAvatar['extension'] {
  if (type === 'image/png') return 'png'
  if (type === 'image/webp') return 'webp'
  return 'jpg'
}

async function prepareAvatar(file: File): Promise<PreparedAvatar> {
  const extension = getAvatarExtension(file.type)
  const outputType = extension === 'jpg' ? 'image/jpeg' : file.type
  const imageUrl = URL.createObjectURL(file)

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('No se pudo leer la imagen'))
      img.src = imageUrl
    })

    const size = 320
    const scale = Math.min(size / image.width, size / image.height, 1)
    const width = Math.max(1, Math.round(image.width * scale))
    const height = Math.max(1, Math.round(image.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')
    if (!context) throw new Error('No se pudo procesar la imagen')

    context.drawImage(image, 0, 0, width, height)

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (nextBlob) => {
          if (nextBlob) resolve(nextBlob)
          else reject(new Error('No se pudo preparar la imagen'))
        },
        outputType,
        0.86,
      )
    })
    const preparedFile = new File([blob], `profile.${extension}`, { type: outputType })

    return { file: preparedFile, extension }
  } finally {
    URL.revokeObjectURL(imageUrl)
  }
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) return

    const avatarUrl = user.user_metadata?.avatar_url
    if (typeof avatarUrl !== 'string' || !avatarUrl.startsWith('data:image/')) return

    const cleanMetadata = { ...user.user_metadata }
    delete cleanMetadata.avatar_url

    supabase.auth.updateUser({ data: cleanMetadata }).then(async ({ data, error }) => {
      if (error) {
        console.error('No se pudo limpiar avatar embebido:', error)
        return
      }
      const refreshed = await supabase.auth.refreshSession()
      if (refreshed.data.user) {
        setUser(refreshed.data.user)
        return
      }
      if (data.user) setUser(data.user)
    })
  }, [user])

  const signUp = useCallback(async (email: string) => {
    await requestSignupCode(email)
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const updateUsername = useCallback(async (newUsername: string) => {
    const { data, error } = await supabase.auth.updateUser({
      data: { username: newUsername }
    })
    if (error) throw error
    if (data.user) setUser(data.user)
  }, [])

  const updateEmail = useCallback(async (newEmail: string) => {
    await requestEmailChangeCode(newEmail)
  }, [])

  const verifyEmailCode = useCallback(async (
    email: string,
    token: string,
    type: EmailVerificationType,
    options?: { password?: string; username?: string },
  ) => {
    const cleanToken = token.replace(/\D/g, '')

    if (type === 'signup') {
      const password = options?.password ?? ''
      const username = options?.username ?? ''
      await verifySignupCode({ email, password, token: cleanToken, username })
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      if (data.user) setUser(data.user)
      return data
    }

    await verifyEmailChangeCode(email, cleanToken)

    const { data, error } = await supabase.auth.refreshSession()
    if (error) {
      const currentUser = await supabase.auth.getUser()
      if (currentUser.error) throw currentUser.error
      if (currentUser.data.user) setUser(currentUser.data.user)
      return currentUser.data
    }

    if (data.user) setUser(data.user)
    return data
  }, [])

  const resendEmailCode = useCallback(async (email: string, type: EmailVerificationType) => {
    await requestVerificationCode(email, type)
  }, [])

  const verifySupabaseEmailCode = useCallback(async (
    email: string,
    token: string,
    type: EmailVerificationType,
  ) => {
    const cleanToken = token.replace(/\D/g, '')
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: cleanToken,
      type,
    })

    if (error && type === 'signup') {
      const fallback = await supabase.auth.verifyOtp({
        email,
        token: cleanToken,
        type: 'email',
      })
      if (fallback.error) throw fallback.error
      if (fallback.data.user) setUser(fallback.data.user)
      return fallback.data
    }

    if (error) throw error
    if (data.user) setUser(data.user)
    return data
  }, [])

  const updatePassword = useCallback(async (newPassword: string) => {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
    if (data.user) setUser(data.user)
  }, [])

  const updateAvatar = useCallback(async (file: File): Promise<string> => {
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) throw new Error('No autenticado')

    const preparedAvatar = await prepareAvatar(file)
    const path = `avatars/${currentUser.id}/profile-${Date.now()}.${preparedAvatar.extension}`
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, preparedAvatar.file, {
        cacheControl: '3600',
        contentType: preparedAvatar.file.type,
        upsert: true,
      })

    if (uploadError) {
      throw new Error(
        `No se pudo subir la foto. Revisa que exista el bucket publico "avatars" en Supabase Storage. ${uploadError.message}`,
      )
    }

    const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(path)
    const nextAvatarUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`

    const { data, error: updateError } = await supabase.auth.updateUser({
      data: { ...currentUser.user_metadata, avatar_url: nextAvatarUrl }
    })
    if (updateError) throw updateError
    if (data.user) setUser(data.user)

    return nextAvatarUrl
  }, [])

  const updateAppearance = useCallback(async (appearance: AppearanceMode) => {
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) throw new Error('No autenticado')
    if (currentUser.user_metadata?.appearance === appearance) {
      setUser(currentUser)
      return
    }

    const { data, error } = await supabase.auth.updateUser({
      data: { ...currentUser.user_metadata, appearance }
    })
    if (error) throw error
    if (data.user) setUser(data.user)
  }, [])

  const updateVoiceProfile = useCallback(async (voiceProfile: VoiceProfileId) => {
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) throw new Error('No autenticado')

    const normalizedVoiceProfile = normalizeVoiceProfile(voiceProfile)
    const { data, error } = await supabase.auth.updateUser({
      data: { ...currentUser.user_metadata, voice_profile: normalizedVoiceProfile }
    })
    if (error) throw error
    if (data.user) setUser(data.user)
  }, [])

  const deleteAccount = useCallback(async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) throw new Error('No autenticado')

    const { data: conversations, error: conversationsError } = await supabase
      .from('conversations')
      .select('id')
      .eq('user_id', currentUser.id)
    if (conversationsError) throw conversationsError

    const conversationIds = conversations?.map((conversation) => conversation.id) ?? []
    if (conversationIds.length > 0) {
      const { error: messagesError } = await supabase
        .from('messages')
        .delete()
        .in('conversation_id', conversationIds)
      if (messagesError) throw messagesError
    }

    const { error: deleteConversationsError } = await supabase
      .from('conversations')
      .delete()
      .eq('user_id', currentUser.id)
    if (deleteConversationsError) throw deleteConversationsError

    await supabase.auth.signOut()
  }, [])

  const getStats = useCallback(async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) return { conversations: 0, messages: 0 }

    const { data: conversations, error: conversationsError } = await supabase
      .from('conversations')
      .select('id')
      .eq('user_id', currentUser.id)
    if (conversationsError) throw conversationsError

    const conversationIds = conversations?.map((conversation) => conversation.id) ?? []
    if (conversationIds.length === 0) {
      return { conversations: 0, messages: 0 }
    }

    const { count: messageCount, error: messagesError } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .in('conversation_id', conversationIds)
    if (messagesError) throw messagesError

    return {
      conversations: conversationIds.length,
      messages: messageCount ?? 0,
    }
  }, [])

  const username = user?.user_metadata?.username || user?.email?.split('@')[0] || 'Usuario'
  const initials = username.slice(0, 2).toUpperCase()
  const avatarUrl = user?.user_metadata?.avatar_url || null
  const appearance = user?.user_metadata?.appearance
  const voiceProfile = user?.user_metadata?.voice_profile

  return {
    user, loading, signUp, signIn, signOut,
    updateUsername, updateEmail, updatePassword, updateAvatar, updateAppearance, updateVoiceProfile,
    verifyEmailCode, verifySupabaseEmailCode, resendEmailCode, deleteAccount, getStats,
    username, initials, avatarUrl, appearance, voiceProfile
  }
}
