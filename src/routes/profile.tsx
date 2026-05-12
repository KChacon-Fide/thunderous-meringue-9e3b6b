import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  Bot,
  Camera,
  Eye,
  EyeOff,
  Hash,
  LogOut,
  MessageSquare,
  Monitor,
  Moon,
  RefreshCw,
  Save,
  ShieldCheck,
  Sun,
  Trash2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { normalizeAppearance, useKodexAppearance, type AppearanceMode } from '@/lib/appearance'
import { useAuth } from '@/lib/auth-hook'

type Stats = {
  conversations: number
  messages: number
}

function Section({ title, children }: { title: string, children: ReactNode }) {
  return (
    <section className="profile-section bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="profile-section-header px-6 py-4 border-b border-gray-50">
        <h2 className="text-sm font-semibold text-[#0D1B3E]">{title}</h2>
      </div>
      <div className="profile-section-body px-6 py-5 flex flex-col gap-4">{children}</div>
    </section>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  disabled,
  hint,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  disabled?: boolean
  hint?: string
}) {
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</label>
      <div className="relative">
        <input
          type={isPassword && show ? 'text' : type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-[#0D1B3E] focus:outline-none focus:border-[#00C9C8] focus:ring-2 focus:ring-[#00C9C8]/10 transition-colors disabled:bg-gray-50 disabled:text-gray-400"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((current) => !current)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label={show ? 'Ocultar contrasena' : 'Mostrar contrasena'}
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

function SaveButton({
  onClick,
  loading,
  saved,
}: {
  onClick: () => void
  loading: boolean
  saved: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
        saved
          ? 'bg-green-50 text-green-600 border border-green-200'
          : 'bg-[#0D1B3E] text-white hover:bg-[#00C9C8] disabled:opacity-50'
      }`}
    >
      <Save className="w-3.5 h-3.5" />
      {loading ? 'Guardando...' : saved ? 'Guardado' : 'Guardar'}
    </button>
  )
}

function LoadingProfile() {
  return (
    <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center px-4">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#0D1B3E] flex items-center justify-center">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <p className="text-sm text-gray-400">Cargando perfil...</p>
      </div>
    </div>
  )
}

function ProfilePage() {
  const navigate = useNavigate()
  const {
    avatarUrl,
    deleteAccount,
    getStats,
    initials,
    loading,
    signOut,
    updateAppearance,
    updateAvatar,
    updateEmail,
    updatePassword,
    updateUsername,
    verifyEmailCode,
    resendEmailCode,
    user,
    username,
    appearance: savedAppearance,
  } = useAuth()
  const { appearance, setAppearance } = useKodexAppearance(savedAppearance)

  const [newUsername, setNewUsername] = useState(username)
  const [newEmail, setNewEmail] = useState(user?.email ?? '')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(avatarUrl)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [stats, setStats] = useState<Stats>({ conversations: 0, messages: 0 })
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [pendingEmail, setPendingEmail] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [emailResendCooldown, setEmailResendCooldown] = useState(0)
  const [savingUsername, setSavingUsername] = useState(false)
  const [savedUsername, setSavedUsername] = useState(false)
  const [savingEmail, setSavingEmail] = useState(false)
  const [savedEmail, setSavedEmail] = useState(false)
  const [verifyingEmail, setVerifyingEmail] = useState(false)
  const [resendingEmailCode, setResendingEmailCode] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [savedPassword, setSavedPassword] = useState(false)
  const [savingAvatar, setSavingAvatar] = useState(false)
  const [savedAvatar, setSavedAvatar] = useState(false)
  const [savingAppearance, setSavingAppearance] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
  const appearanceSaveTimerRef = useRef<number | undefined>(undefined)
  const appearanceRetryTimerRef = useRef<number | undefined>(undefined)
  const latestAppearanceRef = useRef<AppearanceMode>(normalizeAppearance(savedAppearance))
  const persistedAppearanceRef = useRef<AppearanceMode>(normalizeAppearance(savedAppearance))
  const savingAppearanceRef = useRef(false)

  useEffect(() => {
    if (loading) return
    if (!user) {
      navigate({ to: '/' })
      return
    }

    getStats().then(setStats).catch(console.error)
  }, [getStats, loading, navigate, user])

  useEffect(() => {
    setNewUsername(username)
    setNewEmail(user?.email ?? '')
    setAvatarPreview(avatarUrl)
  }, [avatarUrl, user?.email, username])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const searchParams = new URLSearchParams(window.location.search)
    const verificationType = searchParams.get('verify')
    const emailParam = searchParams.get('email')

    if (verificationType !== 'email_change' || !emailParam) return

    setPendingEmail(emailParam)
    setNewEmail(emailParam)
    window.history.replaceState({}, '', window.location.pathname)
  }, [])

  useEffect(() => {
    if (emailResendCooldown <= 0) return

    const interval = window.setInterval(() => {
      setEmailResendCooldown((current) => Math.max(0, current - 1))
    }, 1000)

    return () => window.clearInterval(interval)
  }, [emailResendCooldown])

  useEffect(() => {
    const normalized = normalizeAppearance(savedAppearance)
    persistedAppearanceRef.current = normalized
    latestAppearanceRef.current = appearance
  }, [appearance, savedAppearance])

  useEffect(() => () => {
    window.clearTimeout(appearanceSaveTimerRef.current)
    window.clearTimeout(appearanceRetryTimerRef.current)
  }, [])

  const setError = (key: string, message: string) => {
    setErrors((current) => ({ ...current, [key]: message }))
  }

  const clearError = (key: string) => {
    setErrors((current) => {
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  const flashSaved = (setSaved: (saved: boolean) => void) => {
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2000)
  }

  const isRateLimitError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error ?? '')
    return /rate limit|too many requests|429/i.test(message)
  }

  const persistAppearance = useCallback(async (nextAppearance: AppearanceMode, retryDelay = 0) => {
    window.clearTimeout(appearanceRetryTimerRef.current)

    if (!user) {
      setSavingAppearance(false)
      return
    }

    if (persistedAppearanceRef.current === nextAppearance) {
      setSavingAppearance(false)
      return
    }

    if (savingAppearanceRef.current) {
      appearanceSaveTimerRef.current = window.setTimeout(() => {
        void persistAppearance(latestAppearanceRef.current)
      }, 700)
      return
    }

    savingAppearanceRef.current = true
    if (retryDelay === 0) setSavingAppearance(true)

    try {
      await updateAppearance(nextAppearance)
      persistedAppearanceRef.current = nextAppearance
      clearError('appearance')
    } catch (error) {
      if (isRateLimitError(error)) {
        appearanceRetryTimerRef.current = window.setTimeout(() => {
          void persistAppearance(latestAppearanceRef.current)
        }, retryDelay || 65000)
      } else {
        setError(
          'appearance',
          error instanceof Error
            ? error.message
            : 'No se pudo guardar la preferencia de apariencia',
        )
      }
    } finally {
      savingAppearanceRef.current = false
      setSavingAppearance(false)
    }
  }, [updateAppearance, user])

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      setError('avatar', 'Maximo 2MB')
      return
    }

    clearError('avatar')
    setAvatarFile(file)
    setAvatarPreview((current) => {
      if (current?.startsWith('blob:')) URL.revokeObjectURL(current)
      return URL.createObjectURL(file)
    })
  }

  const handleSaveAvatar = async () => {
    if (!avatarFile) return

    setSavingAvatar(true)
    try {
      const savedAvatarUrl = await updateAvatar(avatarFile)
      setAvatarPreview(savedAvatarUrl)
      flashSaved(setSavedAvatar)
      setAvatarFile(null)
    } catch (error) {
      setError('avatar', error instanceof Error ? error.message : 'No se pudo guardar la foto')
    } finally {
      setSavingAvatar(false)
    }
  }

  const handleSaveUsername = async () => {
    if (!newUsername.trim()) {
      setError('username', 'El nombre no puede estar vacio')
      return
    }

    clearError('username')
    setSavingUsername(true)
    try {
      await updateUsername(newUsername.trim())
      flashSaved(setSavedUsername)
    } catch (error) {
      setError('username', error instanceof Error ? error.message : 'No se pudo guardar el nombre')
    } finally {
      setSavingUsername(false)
    }
  }

  const handleSaveEmail = async () => {
    if (!newEmail.includes('@')) {
      setError('email', 'Email invalido')
      return
    }

    clearError('email')
    setSavingEmail(true)
    try {
      const cleanEmail = newEmail.trim()
      await updateEmail(cleanEmail)
      setPendingEmail(cleanEmail)
      setEmailCode('')
      setEmailResendCooldown(60)
      setSavedEmail(false)
    } catch (error) {
      setError('email', error instanceof Error ? error.message : 'No se pudo guardar el email')
    } finally {
      setSavingEmail(false)
    }
  }

  const handleVerifyEmail = async () => {
    const cleanCode = emailCode.replace(/\D/g, '')
    if (!pendingEmail) return
    if (cleanCode.length < 6) {
      setError('email', 'Ingresa el codigo de 6 digitos.')
      return
    }

    clearError('email')
    setVerifyingEmail(true)
    try {
      await verifyEmailCode(pendingEmail, cleanCode, 'email_change')
      setPendingEmail('')
      setEmailCode('')
      flashSaved(setSavedEmail)
    } catch (error) {
      setError('email', error instanceof Error ? error.message : 'No se pudo verificar el codigo')
    } finally {
      setVerifyingEmail(false)
    }
  }

  const handleResendEmailCode = async () => {
    if (!pendingEmail) return

    clearError('email')
    setResendingEmailCode(true)
    try {
      await resendEmailCode(pendingEmail, 'email_change')
      setEmailResendCooldown(60)
    } catch (error) {
      setError('email', error instanceof Error ? error.message : 'No se pudo reenviar el codigo')
    } finally {
      setResendingEmailCode(false)
    }
  }

  const handleSavePassword = async () => {
    if (newPassword.length < 6) {
      setError('password', 'Minimo 6 caracteres')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('password', 'Las contrasenas no coinciden')
      return
    }

    clearError('password')
    setSavingPassword(true)
    try {
      await updatePassword(newPassword)
      setNewPassword('')
      setConfirmPassword('')
      flashSaved(setSavedPassword)
    } catch (error) {
      setError('password', error instanceof Error ? error.message : 'No se pudo cambiar la contrasena')
    } finally {
      setSavingPassword(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteInput !== 'ELIMINAR') return

    try {
      await deleteAccount()
      navigate({ to: '/' })
    } catch (error) {
      setError('delete', error instanceof Error ? error.message : 'No se pudo eliminar la cuenta')
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate({ to: '/' })
  }

  const handleAppearanceChange = (nextAppearance: AppearanceMode) => {
    clearError('appearance')
    setAppearance(nextAppearance)
    latestAppearanceRef.current = nextAppearance
    window.clearTimeout(appearanceSaveTimerRef.current)
    window.clearTimeout(appearanceRetryTimerRef.current)

    if (!user) return

    if (persistedAppearanceRef.current === nextAppearance) return

    setSavingAppearance(true)
    appearanceSaveTimerRef.current = window.setTimeout(() => {
      void persistAppearance(latestAppearanceRef.current)
    }, 900)
  }

  if (loading) return <LoadingProfile />
  if (!user) return null

  return (
    <div className="profile-page min-h-screen bg-[#F5F7FA]">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate({ to: '/' })}
            className="p-2 rounded-lg text-gray-400 hover:text-[#0D1B3E] hover:bg-gray-100 transition-colors"
            aria-label="Volver"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-base font-semibold text-[#0D1B3E]">Perfil</h1>
        </div>
      </header>

      <main className="profile-shell max-w-2xl mx-auto px-4 py-8 flex flex-col gap-5">
        <Section title="Foto de perfil">
          <div className="profile-avatar-row flex items-center gap-5">
            <div className="relative flex-shrink-0">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Avatar"
                  className="w-20 h-20 rounded-full object-cover border-2 border-[#00C9C8]/30"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-[#0D1B3E] flex items-center justify-center text-white text-2xl font-bold">
                  {initials}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 w-7 h-7 bg-[#00C9C8] rounded-full flex items-center justify-center shadow-md hover:bg-[#0D1B3E] transition-colors"
                aria-label="Cambiar foto de perfil"
              >
                <Camera className="w-3.5 h-3.5 text-white" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#0D1B3E] truncate">{username}</p>
              <p className="text-xs text-gray-400 mt-0.5 truncate">{user.email}</p>
              <p className="text-xs text-gray-400 mt-0.5">Maximo 2MB, JPG, PNG o WebP</p>
              {errors.avatar && <p className="text-xs text-red-500 mt-1">{errors.avatar}</p>}
            </div>
          </div>
          {avatarFile && (
              <div className="profile-actions-row flex justify-end">
              <SaveButton onClick={handleSaveAvatar} loading={savingAvatar} saved={savedAvatar} />
            </div>
          )}
        </Section>

        <Section title="Cambiar nombre de usuario">
          <Field label="Nombre" value={newUsername} onChange={setNewUsername} placeholder="Tu nombre" />
          {errors.username && <p className="text-xs text-red-500">{errors.username}</p>}
          <div className="profile-actions-row flex justify-end">
            <SaveButton onClick={handleSaveUsername} loading={savingUsername} saved={savedUsername} />
          </div>
        </Section>

        <Section title="Cambiar email">
          <Field
            label="Email"
            value={newEmail}
            onChange={setNewEmail}
            type="email"
            placeholder="tu@email.com"
            hint="Se enviara un codigo de confirmacion al nuevo email."
          />
          {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
          <div className="profile-actions-row flex justify-end">
            <SaveButton onClick={handleSaveEmail} loading={savingEmail} saved={savedEmail} />
          </div>
          {pendingEmail && (
            <div className="rounded-xl border border-[#00C9C8]/25 bg-[#00C9C8]/5 p-4 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#0D1B3E] flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-4 h-4 text-[#00C9C8]" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#0D1B3E]">Verificar nuevo correo</p>
                  <p className="text-xs text-gray-500 truncate">{pendingEmail}</p>
                </div>
              </div>
              <input
                value={emailCode}
                inputMode="numeric"
                maxLength={6}
                onChange={(event) => setEmailCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Codigo de 6 digitos"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-center text-sm tracking-[0.35em] font-mono focus:outline-none focus:border-[#00C9C8] focus:ring-2 focus:ring-[#00C9C8]/10 transition-colors"
              />
              <div className="profile-actions-row flex flex-wrap gap-2 justify-end">
                <button
                  type="button"
                  onClick={handleResendEmailCode}
                  disabled={resendingEmailCode || verifyingEmail || emailResendCooldown > 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className="w-4 h-4" />
                  {resendingEmailCode
                    ? 'Reenviando...'
                    : emailResendCooldown > 0
                      ? `Reenviar en ${emailResendCooldown}s`
                      : 'Reenviar codigo'}
                </button>
                <button
                  type="button"
                  onClick={handleVerifyEmail}
                  disabled={verifyingEmail || resendingEmailCode}
                  className="px-4 py-2 rounded-xl bg-[#0D1B3E] text-white text-sm font-medium hover:bg-[#00C9C8] transition-colors disabled:opacity-50"
                >
                  {verifyingEmail ? 'Verificando...' : 'Ingresar para verificar'}
                </button>
              </div>
            </div>
          )}
        </Section>

        <Section title="Cambiar contrasena">
          <Field
            label="Nueva contrasena"
            value={newPassword}
            onChange={setNewPassword}
            type="password"
            placeholder="Minimo 6 caracteres"
          />
          <Field
            label="Confirmar contrasena"
            value={confirmPassword}
            onChange={setConfirmPassword}
            type="password"
            placeholder="Repeti la contrasena"
          />
          {errors.password && <p className="text-xs text-red-500">{errors.password}</p>}
          <div className="profile-actions-row flex justify-end">
            <SaveButton onClick={handleSavePassword} loading={savingPassword} saved={savedPassword} />
          </div>
        </Section>

        <Section title="Estadisticas de uso">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-4 bg-[#0D1B3E]/5 rounded-xl">
              <div className="w-9 h-9 rounded-lg bg-[#0D1B3E] flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-4 h-4 text-[#00C9C8]" />
              </div>
              <div>
                <p className="text-xl font-bold text-[#0D1B3E]">{stats.conversations}</p>
                <p className="text-xs text-gray-400">Conversaciones</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-[#0D1B3E]/5 rounded-xl">
              <div className="w-9 h-9 rounded-lg bg-[#0D1B3E] flex items-center justify-center flex-shrink-0">
                <Hash className="w-4 h-4 text-[#00C9C8]" />
              </div>
              <div>
                <p className="text-xl font-bold text-[#0D1B3E]">{stats.messages}</p>
                <p className="text-xs text-gray-400">Mensajes totales</p>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-400">
            Miembro desde{' '}
            {new Date(user.created_at).toLocaleDateString('es-CR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </Section>

        <Section title="Apariencia">
          <p className="text-xs text-gray-400">Elegi como se ve KODEX IA.</p>
          <div className="profile-appearance-grid grid grid-cols-3 gap-3">
            {([
              { value: 'light', label: 'Claro', icon: Sun },
              { value: 'dark', label: 'Oscuro', icon: Moon },
              { value: 'auto', label: 'Auto', icon: Monitor },
            ] satisfies Array<{ value: AppearanceMode; label: string; icon: LucideIcon }>).map(
              ({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleAppearanceChange(value)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    appearance === value
                      ? 'border-[#00C9C8] bg-[#00C9C8]/5 text-[#0D1B3E]'
                      : 'border-gray-100 bg-white text-gray-400 hover:border-gray-200'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{label}</span>
                </button>
              ),
            )}
          </div>
          {appearance === 'auto' && (
            <p className="text-xs text-gray-400">
              Cambia automaticamente segun la hora: claro de 6:00 a 17:59 y oscuro de 18:00 a 5:59.
            </p>
          )}
          {savingAppearance && <p className="text-xs text-gray-400">Guardando preferencia...</p>}
          {errors.appearance && <p className="text-xs text-red-500">{errors.appearance}</p>}
        </Section>

        <Section title="Cerrar sesion">
          <p className="text-xs text-gray-400">Cerra sesion en este dispositivo.</p>
          <div>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Cerrar sesion
            </button>
          </div>
        </Section>

        <Section title="Eliminar cuenta">
          <p className="text-xs text-gray-500">
            Eliminar tu cuenta borra permanentemente tus conversaciones y mensajes. Esta accion no se
            puede deshacer.
          </p>
          {!showDeleteConfirm ? (
            <div>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 text-sm text-red-500 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar cuenta
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 p-4 bg-red-50 border border-red-100 rounded-xl">
              <p className="text-xs text-red-600 font-medium">
                Escribi <strong>ELIMINAR</strong> para confirmar:
              </p>
              <input
                value={deleteInput}
                onChange={(event) => setDeleteInput(event.target.value)}
                placeholder="ELIMINAR"
                className="px-3 py-2 rounded-lg border border-red-200 text-sm focus:outline-none focus:border-red-400 bg-white"
              />
              {errors.delete && <p className="text-xs text-red-500">{errors.delete}</p>}
            <div className="profile-actions-row flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(false)
                    setDeleteInput('')
                  }}
                  className="px-4 py-2 rounded-lg text-xs font-medium border border-gray-200 text-gray-500 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deleteInput !== 'ELIMINAR'}
                  className="px-4 py-2 rounded-lg text-xs font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-40 transition-colors"
                >
                  Eliminar permanentemente
                </button>
              </div>
            </div>
          )}
        </Section>
      </main>
    </div>
  )
}

export const Route = createFileRoute('/profile')({
  component: ProfilePage,
})
