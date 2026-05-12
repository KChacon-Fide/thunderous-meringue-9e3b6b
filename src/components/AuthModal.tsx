import { useEffect, useMemo, useState } from 'react'
import { Bot, RefreshCw, ShieldCheck, X } from 'lucide-react'

import type { EmailVerificationType } from '@/lib/auth-hook'

type Mode = 'login' | 'register'

type VerificationRequest = {
  email: string
  type: EmailVerificationType
  password?: string
  username?: string
}

const generateCaptcha = () => String(Math.floor(10000 + Math.random() * 90000))

function CaptchaDigits({ value }: { value: string }) {
  const rotations = useMemo(() => [-9, 6, -3, 10, -6], [])

  return (
    <div className="relative h-12 flex items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-100">
      <div className="absolute inset-x-2 top-1/2 h-px -rotate-6 bg-[#00C9C8]/40" />
      <div className="absolute inset-x-4 top-4 h-px rotate-12 bg-[#0D1B3E]/20" />
      <div className="absolute left-4 top-2 h-8 w-8 rounded-full border border-[#0D1B3E]/15" />
      <div className="absolute right-5 bottom-1 h-7 w-14 -rotate-12 border-t border-[#00C9C8]/30" />
      <div className="relative flex items-center gap-1">
        {value.split('').map((digit, index) => (
          <span
            key={`${digit}-${index}`}
            className="select-none font-mono text-xl font-black text-[#0D1B3E]/70 blur-[0.3px]"
            style={{ transform: `rotate(${rotations[index] ?? 0}deg) translateY(${index % 2 ? 2 : -1}px)` }}
          >
            {digit}
          </span>
        ))}
      </div>
    </div>
  )
}

export function AuthModal({
  initialVerification,
  onClose,
  onResendEmailCode,
  onSignIn,
  onSignUp,
  onVerifyEmailCode,
}: {
  initialVerification?: VerificationRequest | null
  onClose: () => void
  onSignIn: (email: string, password: string) => Promise<void>
  onSignUp: (email: string, password: string, username: string) => Promise<void>
  onVerifyEmailCode: (
    email: string,
    code: string,
    type: EmailVerificationType,
    options?: { password?: string; username?: string },
  ) => Promise<unknown>
  onResendEmailCode: (email: string, type: EmailVerificationType) => Promise<void>
}) {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState(initialVerification?.email ?? '')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [captcha, setCaptcha] = useState(generateCaptcha)
  const [captchaInput, setCaptchaInput] = useState('')
  const [verification, setVerification] = useState<VerificationRequest | null>(
    initialVerification ?? null,
  )
  const [verificationCode, setVerificationCode] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (!initialVerification) return
    setVerification(initialVerification)
    setEmail(initialVerification.email)
  }, [initialVerification])

  useEffect(() => {
    if (resendCooldown <= 0) return

    const interval = window.setInterval(() => {
      setResendCooldown((current) => Math.max(0, current - 1))
    }, 1000)

    return () => window.clearInterval(interval)
  }, [resendCooldown])

  const resetCaptcha = () => {
    setCaptcha(generateCaptcha())
    setCaptchaInput('')
  }

  const handleSubmit = async () => {
    setError('')
    setSuccess('')

    if (!email || !password) {
      setError('Por favor completa todos los campos.')
      return
    }

    if (mode === 'register' && !username.trim()) {
      setError('Por favor ingresa un nombre de usuario.')
      return
    }

    if (mode === 'register' && captchaInput.trim() !== captcha) {
      setError('El codigo visual no coincide. Intentalo de nuevo.')
      resetCaptcha()
      return
    }

    setLoading(true)
    try {
      if (mode === 'login') {
        await onSignIn(email.trim(), password)
        onClose()
      } else {
        const cleanEmail = email.trim()
        const cleanUsername = username.trim()
        await onSignUp(cleanEmail, password, cleanUsername)
        setVerification({
          email: cleanEmail,
          password,
          type: 'signup',
          username: cleanUsername,
        })
        setVerificationCode('')
        resetCaptcha()
        setResendCooldown(60)
        setSuccess('Te enviamos un codigo de verificacion al correo. Puedes reenviar otro en 60 segundos.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrio un error.')
      resetCaptcha()
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async () => {
    if (!verification) return

    setError('')
    setSuccess('')

    const cleanCode = verificationCode.replace(/\D/g, '')
    if (cleanCode.length < 6) {
      setError('Ingresa el codigo de 6 digitos.')
      return
    }

    setLoading(true)
    try {
      await onVerifyEmailCode(verification.email, cleanCode, verification.type, {
        password: verification.password,
        username: verification.username,
      })
      setSuccess('Correo verificado correctamente.')
      window.setTimeout(onClose, 700)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo verificar el codigo.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (!verification) return

    setError('')
    setSuccess('')
    setLoading(true)
    try {
      await onResendEmailCode(verification.email, verification.type)
      setResendCooldown(60)
      setSuccess('Enviamos un nuevo codigo al correo.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo reenviar el codigo.')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== 'Enter') return
    if (verification) handleVerify()
    else handleSubmit()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-3 py-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="auth-modal-panel relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-[#0D1B3E] flex items-center justify-center mb-3">
            {verification ? <ShieldCheck className="w-6 h-6 text-[#00C9C8]" /> : <Bot className="w-6 h-6 text-white" />}
          </div>
          <span className="text-xl font-bold tracking-widest text-[#0D1B3E]">KODEX IA</span>
          <p className="text-sm text-gray-500 mt-1 text-center">
            {verification
              ? 'Ingresa el codigo que enviamos a tu correo.'
              : mode === 'login'
                ? 'Inicia sesion para continuar'
                : 'Crea tu cuenta gratis'}
          </p>
        </div>

        {verification ? (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-[#00C9C8]/25 bg-[#00C9C8]/5 px-4 py-3">
              <p className="text-xs font-medium text-[#0D1B3E]">Correo en verificacion</p>
              <p className="text-sm text-gray-600 truncate">{verification.email}</p>
            </div>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="Codigo de 6 digitos"
              value={verificationCode}
              onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={handleKeyDown}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-center text-lg tracking-[0.35em] font-mono focus:outline-none focus:border-[#00C9C8] focus:ring-2 focus:ring-[#00C9C8]/10 transition-colors"
            />
            <button
              type="button"
              onClick={handleVerify}
              disabled={loading}
              className="w-full mt-2 py-3 rounded-xl bg-[#0D1B3E] text-white text-sm font-semibold hover:bg-[#00C9C8] transition-colors disabled:opacity-50"
            >
              {loading ? 'Verificando...' : 'Ingresar para verificar'}
            </button>
            <button
              type="button"
              onClick={handleResend}
              disabled={loading || resendCooldown > 0}
              className="text-xs font-semibold text-[#0D1B3E] hover:text-[#00C9C8] transition-colors"
            >
              {resendCooldown > 0 ? `Reenviar en ${resendCooldown}s` : 'Reenviar codigo'}
            </button>
          </div>
        ) : (
          <>
            <div className="flex rounded-xl bg-gray-100 p-1 mb-6">
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); setSuccess('') }}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                  mode === 'login' ? 'bg-white text-[#0D1B3E] shadow-sm' : 'text-gray-500'
                }`}
              >
                Iniciar sesion
              </button>
              <button
                type="button"
                onClick={() => { setMode('register'); setError(''); setSuccess(''); resetCaptcha() }}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                  mode === 'register' ? 'bg-white text-[#0D1B3E] shadow-sm' : 'text-gray-500'
                }`}
              >
                Registrarse
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {mode === 'register' && (
                <input
                  type="text"
                  placeholder="Nombre de usuario"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#00C9C8] focus:ring-2 focus:ring-[#00C9C8]/10 transition-colors"
                />
              )}
              <input
                type="email"
                placeholder="Correo electronico"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#00C9C8] focus:ring-2 focus:ring-[#00C9C8]/10 transition-colors"
              />
              <input
                type="password"
                placeholder="Contrasena"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#00C9C8] focus:ring-2 focus:ring-[#00C9C8]/10 transition-colors"
              />

              {mode === 'register' && (
                <div className="auth-captcha-grid grid grid-cols-[1fr_auto] gap-2 items-center">
                  <CaptchaDigits value={captcha} />
                  <button
                    type="button"
                    onClick={resetCaptcha}
                    className="h-12 w-12 flex items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:text-[#0D1B3E] hover:bg-gray-50 transition-colors"
                    aria-label="Generar otro captcha"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Digite los numeros"
                    value={captchaInput}
                    onChange={(event) => setCaptchaInput(event.target.value.replace(/\D/g, '').slice(0, 5))}
                    onKeyDown={handleKeyDown}
                    className="col-span-2 w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#00C9C8] focus:ring-2 focus:ring-[#00C9C8]/10 transition-colors"
                  />
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="w-full mt-5 py-3 rounded-xl bg-[#0D1B3E] text-white text-sm font-semibold hover:bg-[#00C9C8] transition-colors disabled:opacity-50"
            >
              {loading ? 'Cargando...' : mode === 'login' ? 'Iniciar sesion' : 'Crear cuenta'}
            </button>
          </>
        )}

        {error && (
          <p className="mt-3 text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        {success && (
          <p className="mt-3 text-xs text-green-600 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
            {success}
          </p>
        )}

        <p className="text-center text-xs text-gray-400 mt-4">
          Kodex Tech Solutions - Todos los derechos reservados
        </p>
      </div>
    </div>
  )
}
