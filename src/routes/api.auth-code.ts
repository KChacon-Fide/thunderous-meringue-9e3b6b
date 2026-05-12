import { createFileRoute } from '@tanstack/react-router'

import {
  codesMatch,
  generateCode,
  getAdminClient,
  jsonError,
  normalizeCode,
  normalizeEmail,
  sendVerificationEmail,
  storeVerificationCode,
  type VerificationPurpose,
} from '@/lib/server-mail'

type AuthCodeAction =
  | 'signup_send'
  | 'signup_verify'
  | 'email_change_send'
  | 'email_change_verify'

type RequestBody = {
  action?: AuthCodeAction
  accessToken?: string
  email?: string
  password?: string
  token?: string
  username?: string
}

async function getBearerUser(request: Request, bodyAccessToken?: string) {
  const authHeader = request.headers.get('authorization')
  const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : ''
  const token = bodyAccessToken || headerToken

  if (!token) throw new Error('No hay sesion autenticada.')

  const admin = getAdminClient()
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) {
    const detail = error?.message ? ` ${error.message}` : ''
    throw new Error(`Sesion invalida.${detail}`)
  }

  return data.user
}

async function findValidCode(email: string, purpose: VerificationPurpose, token: string) {
  const admin = getAdminClient()
  const { data, error } = await admin
    .from('email_verification_codes')
    .select('id, code_hash, expires_at')
    .eq('email', email)
    .eq('purpose', purpose)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('No hay un codigo activo para este correo.')
  if (new Date(data.expires_at as string).getTime() < Date.now()) {
    throw new Error('El codigo vencio. Solicita uno nuevo.')
  }
  if (!codesMatch(token, data.code_hash as string)) {
    throw new Error('El codigo no coincide.')
  }

  return data.id as string
}

async function consumeCode(id: string) {
  const admin = getAdminClient()
  const { error } = await admin
    .from('email_verification_codes')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}

async function sendCode(email: string, purpose: VerificationPurpose) {
  const code = generateCode()
  const result = await storeVerificationCode(email, purpose, code)
  await sendVerificationEmail({ code, email, purpose })
  return result
}

export const Route = createFileRoute('/api/auth-code')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as RequestBody
          const action = body.action
          const email = normalizeEmail(body.email)

          if (!action) throw new Error('Accion invalida.')
          if (!email || !email.includes('@')) throw new Error('Email invalido.')

          if (action === 'signup_send') {
            const result = await sendCode(email, 'signup')
            return Response.json({ ok: true, ...result })
          }

          if (action === 'signup_verify') {
            const token = normalizeCode(body.token)
            const password = typeof body.password === 'string' ? body.password : ''
            const username = typeof body.username === 'string' ? body.username.trim() : ''

            if (token.length !== 6) throw new Error('Codigo invalido.')
            if (password.length < 6) throw new Error('La contrasena debe tener al menos 6 caracteres.')
            if (!username) throw new Error('El nombre de usuario es requerido.')

            const codeId = await findValidCode(email, 'signup', token)
            const admin = getAdminClient()
            const { error } = await admin.auth.admin.createUser({
              email,
              password,
              email_confirm: true,
              user_metadata: { username },
            } as any)

            if (error) throw error
            await consumeCode(codeId)
            return Response.json({ ok: true })
          }

          if (action === 'email_change_send') {
            await getBearerUser(request, body.accessToken)
            const result = await sendCode(email, 'email_change')
            return Response.json({ ok: true, ...result })
          }

          if (action === 'email_change_verify') {
            const token = normalizeCode(body.token)
            if (token.length !== 6) throw new Error('Codigo invalido.')

            const user = await getBearerUser(request, body.accessToken)
            const codeId = await findValidCode(email, 'email_change', token)
            const admin = getAdminClient()
            const { error } = await admin.auth.admin.updateUserById(user.id, {
              email,
              email_confirm: true,
            } as any)

            if (error) throw error
            await consumeCode(codeId)
            return Response.json({ ok: true })
          }

          throw new Error('Accion invalida.')
        } catch (error) {
          console.error('Auth code error:', error)
          return jsonError(error, 400)
        }
      },
    },
  },
})
