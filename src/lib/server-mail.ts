import { Buffer } from 'node:buffer'
import { createHash, randomInt, randomUUID, timingSafeEqual } from 'node:crypto'
import tls from 'node:tls'

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://hhtevkdqhbsfwwheaekz.supabase.co'
const EMAIL_FROM = 'kodextech.cr@gmail.com'
const CODE_TTL_MINUTES = 10
const COOLDOWN_SECONDS = 60

export type VerificationPurpose = 'signup' | 'email_change'

type MailOptions = {
  code: string
  email: string
  purpose: VerificationPurpose
}

export function getAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceRoleKey) {
    throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY en variables de entorno.')
  }

  return createClient(SUPABASE_URL, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export function generateCode() {
  return String(randomInt(100000, 1000000))
}

export function hashCode(code: string) {
  return createHash('sha256').update(code).digest('hex')
}

export function codesMatch(inputCode: string, storedHash: string) {
  const inputHash = hashCode(inputCode)
  const left = Buffer.from(inputHash)
  const right = Buffer.from(storedHash)
  return left.length === right.length && timingSafeEqual(left, right)
}

export function normalizeEmail(email: unknown) {
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

export function normalizeCode(token: unknown) {
  return typeof token === 'string' ? token.replace(/\D/g, '').slice(0, 6) : ''
}

export function jsonError(error: unknown, status = 400) {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'object' && error && 'message' in error
      ? String((error as { message: unknown }).message)
      : 'Solicitud invalida.'
  const hint = typeof error === 'object' && error && 'hint' in error
    ? String((error as { hint: unknown }).hint)
    : ''

  return Response.json({ error: hint ? `${message}. ${hint}` : message }, { status })
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildCorporateEmail({ code, email, purpose }: MailOptions) {
  const isEmailChange = purpose === 'email_change'
  const title = isEmailChange ? 'Confirma tu nuevo correo' : 'Verifica tu cuenta'
  const intro = isEmailChange
    ? 'Usa este codigo para dejar tu nuevo email en vigencia en KODEX IA.'
    : 'Usa este codigo para activar tu cuenta en KODEX IA.'
  const safeEmail = escapeHtml(email)

  return {
    subject: isEmailChange
      ? 'Confirma tu nuevo correo - KODEX IA'
      : 'Codigo de verificacion - KODEX IA',
    html: `<div style="margin:0;padding:0;background:#080f20;font-family:Inter,Arial,sans-serif;color:#e8edf7;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#080f20;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#101a31;border:1px solid #23314f;border-radius:18px;overflow:hidden;">
        <tr><td style="padding:28px 28px 18px;border-bottom:1px solid #23314f;">
          <div style="font-size:12px;letter-spacing:4px;font-weight:800;color:#00C9C8;">KODEX IA</div>
          <h1 style="margin:14px 0 0;font-size:24px;line-height:1.25;color:#ffffff;">${title}</h1>
          <p style="margin:8px 0 0;font-size:14px;line-height:1.6;color:#a7b2c7;">${intro}</p>
        </td></tr>
        <tr><td style="padding:28px;">
          <div style="background:#071225;border:1px solid rgba(0,201,200,0.35);border-radius:14px;padding:22px;text-align:center;">
            <div style="font-size:12px;text-transform:uppercase;letter-spacing:2px;color:#a7b2c7;">Codigo de verificacion</div>
            <div style="margin-top:10px;font-size:36px;letter-spacing:10px;font-weight:900;color:#00C9C8;">${code}</div>
          </div>
          <p style="margin:18px 0 0;font-size:13px;line-height:1.7;color:#a7b2c7;">Correo: <strong style="color:#ffffff;">${safeEmail}</strong></p>
          <p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#748198;">Este codigo vence en ${CODE_TTL_MINUTES} minutos. Si no solicitaste esta accion, ignora este correo.</p>
        </td></tr>
        <tr><td style="padding:18px 28px;background:#071225;color:#748198;font-size:12px;">
          Kodex Tech Solutions - ${EMAIL_FROM}
        </td></tr>
      </table>
    </td></tr>
  </table>
</div>`,
    text: `KODEX IA\n\n${title}\n\nCodigo: ${code}\nCorreo: ${email}\n\nEste codigo vence en ${CODE_TTL_MINUTES} minutos.\nKodex Tech Solutions - ${EMAIL_FROM}`,
  }
}

function readSmtpResponse(socket: tls.TLSSocket) {
  return new Promise<string>((resolve, reject) => {
    let buffer = ''
    const timeout = windowlessSetTimeout(() => {
      cleanup()
      reject(new Error('Tiempo de espera agotado enviando correo.'))
    }, 15000)

    const cleanup = () => {
      clearTimeout(timeout)
      socket.off('data', onData)
      socket.off('error', onError)
    }

    const onError = (error: Error) => {
      cleanup()
      reject(error)
    }

    const onData = (data: Buffer) => {
      buffer += data.toString('utf8')
      const lines = buffer.split(/\r?\n/).filter(Boolean)
      const lastLine = lines[lines.length - 1]
      if (lastLine && /^\d{3}\s/.test(lastLine)) {
        cleanup()
        resolve(buffer)
      }
    }

    socket.on('data', onData)
    socket.on('error', onError)
  })
}

function windowlessSetTimeout(callback: () => void, ms: number) {
  return setTimeout(callback, ms)
}

async function smtpCommand(socket: tls.TLSSocket, command: string, expected: number[]) {
  socket.write(`${command}\r\n`)
  const response = await readSmtpResponse(socket)
  const code = Number(response.slice(0, 3))
  if (!expected.includes(code)) {
    throw new Error(`SMTP rechazo el comando ${command.split(' ')[0]}: ${response.trim()}`)
  }
}

function encodeHeader(value: string) {
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`
}

function buildMimeMessage(to: string, subject: string, html: string, text: string) {
  const boundary = `kodex-${randomUUID()}`

  return [
    `From: "KODEX IA" <${EMAIL_FROM}>`,
    `To: <${to}>`,
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    text,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    html,
    '',
    `--${boundary}--`,
    '',
  ].join('\r\n')
}

export async function sendVerificationEmail(options: MailOptions) {
  const appPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, '')
  if (!appPassword) {
    throw new Error('Falta GMAIL_APP_PASSWORD para enviar correos desde kodextech.cr@gmail.com.')
  }

  const { subject, html, text } = buildCorporateEmail(options)
  const message = buildMimeMessage(options.email, subject, html, text)
  const socket = tls.connect(465, 'smtp.gmail.com')

  try {
    await readSmtpResponse(socket)
    await smtpCommand(socket, 'EHLO kodexia.local', [250])
    await smtpCommand(socket, 'AUTH LOGIN', [334])
    await smtpCommand(socket, Buffer.from(EMAIL_FROM).toString('base64'), [334])
    await smtpCommand(socket, Buffer.from(appPassword).toString('base64'), [235])
    await smtpCommand(socket, `MAIL FROM:<${EMAIL_FROM}>`, [250])
    await smtpCommand(socket, `RCPT TO:<${options.email}>`, [250, 251])
    await smtpCommand(socket, 'DATA', [354])
    await smtpCommand(socket, `${message}\r\n.`, [250])
    await smtpCommand(socket, 'QUIT', [221])
  } finally {
    socket.destroy()
  }
}

export async function storeVerificationCode(email: string, purpose: VerificationPurpose, code: string) {
  const admin = getAdminClient()
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString()
  const nextAllowedAt = new Date(Date.now() + COOLDOWN_SECONDS * 1000).toISOString()

  const { data: previous, error: previousError } = await admin
    .from('email_verification_codes')
    .select('next_allowed_at')
    .eq('email', email)
    .eq('purpose', purpose)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (previousError) throw previousError

  if (previous?.next_allowed_at && new Date(previous.next_allowed_at).getTime() > Date.now()) {
    const seconds = Math.ceil((new Date(previous.next_allowed_at).getTime() - Date.now()) / 1000)
    throw new Error(`Espera ${seconds} segundos antes de reenviar otro codigo.`)
  }

  const { error: expireOldError } = await admin
    .from('email_verification_codes')
    .update({ consumed_at: new Date().toISOString() })
    .eq('email', email)
    .eq('purpose', purpose)
    .is('consumed_at', null)

  if (expireOldError) throw expireOldError

  const { error } = await admin.from('email_verification_codes').insert({
    email,
    purpose,
    code_hash: hashCode(code),
    expires_at: expiresAt,
    next_allowed_at: nextAllowedAt,
  })

  if (error) throw error

  return { cooldownSeconds: COOLDOWN_SECONDS }
}
