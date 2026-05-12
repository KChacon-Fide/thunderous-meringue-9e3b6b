import { supabase } from './supabase'
import type { Message } from './ai-hook'

export type Conversation = {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export async function loadConversations(): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function createConversation(title: string): Promise<Conversation> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No hay usuario autenticado')

  const { data, error } = await supabase
    .from('conversations')
    .insert({ title, user_id: user.id })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateConversationTitle(id: string, title: string) {
  await supabase
    .from('conversations')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('id', id)
}

export async function deleteConversation(id: string) {
  await supabase.from('conversations').delete().eq('id', id)
}

export async function loadMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error) throw error

  const seenUserMessages = new Map<string, number>()
  const accidentalDuplicateWindowMs = 2 * 60 * 1000
  const rows = data ?? []

  return rows.filter((m, index) => {
    if (m.role !== 'user') return true

    const contentKey = String(m.content ?? '').trim()
    if (!contentKey) return true

    const createdAt = Date.parse(m.created_at)
    const previousCreatedAt = seenUserMessages.get(contentKey)
    const nextMessage = rows[index + 1]
    if (
      Number.isFinite(createdAt) &&
      previousCreatedAt !== undefined &&
      Math.abs(createdAt - previousCreatedAt) <= accidentalDuplicateWindowMs &&
      nextMessage?.role !== 'assistant'
    ) {
      return false
    }

    if (Number.isFinite(createdAt)) {
      seenUserMessages.set(contentKey, createdAt)
    }

    return true
  }).map((m) => ({
    id: m.id,
    role: m.role as 'user' | 'assistant',
    content: m.content,
    feedback: m.feedback ?? undefined,
  }))
}

export async function saveMessage(
  conversationId: string,
  message: Message
): Promise<void> {
  const { error } = await supabase.from('messages').upsert({
    id: message.id,
    conversation_id: conversationId,
    role: message.role,
    content: message.content,
    feedback: message.feedback ?? null,
  })
  if (error) console.error('Error guardando mensaje:', error)
}

export async function updateMessageFeedback(
  messageId: string,
  feedback: 'like' | 'dislike' | null
) {
  await supabase.from('messages').update({ feedback }).eq('id', messageId)
}
