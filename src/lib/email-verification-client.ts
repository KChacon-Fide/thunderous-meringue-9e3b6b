import type { EmailVerificationType } from './auth-hook'

type ApiResponse<T> = T & {
  error?: string
  detail?: string
}

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}))

  if (!response.ok) {
    const error = body?.error || 'No se pudo procesar la solicitud.'
    const detail = body?.detail ? ` ${body.detail}` : ''
    throw new Error(`${error}${detail}`)
  }

  return body
}

async function getAccessToken() {
  const { supabase } = await import('./supabase')
  const { data } = await supabase.auth.getSession()
  const session = data.session

  if (!session?.access_token) return ''

  const refreshed = await supabase.auth.refreshSession()
  if (!refreshed.error && refreshed.data.session?.access_token) {
    return refreshed.data.session.access_token
  }

  return session.access_token
}

export async function requestSignupCode(email: string) {
  const response = await fetch('/api/auth-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'signup_send', email }),
  })

  return readJson<ApiResponse<{ ok: true; cooldownSeconds: number }>>(response)
}

export async function verifySignupCode({
  email,
  password,
  token,
  username,
}: {
  email: string
  password: string
  token: string
  username: string
}) {
  const response = await fetch('/api/auth-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'signup_verify', email, password, token, username }),
  })

  return readJson<ApiResponse<{ ok: true }>>(response)
}

export async function requestEmailChangeCode(email: string) {
  const accessToken = await getAccessToken()
  const response = await fetch('/api/auth-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'email_change_send', email, accessToken }),
  })

  return readJson<ApiResponse<{ ok: true; cooldownSeconds: number }>>(response)
}

export async function verifyEmailChangeCode(email: string, token: string) {
  const accessToken = await getAccessToken()
  const response = await fetch('/api/auth-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'email_change_verify', email, token, accessToken }),
  })

  return readJson<ApiResponse<{ ok: true }>>(response)
}

export async function requestVerificationCode(email: string, type: EmailVerificationType) {
  if (type === 'signup') return requestSignupCode(email)
  return requestEmailChangeCode(email)
}
