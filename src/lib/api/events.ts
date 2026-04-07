import { supabase } from '@/lib/supabase'
import type { Event, EventInsert, EventUpdate } from '@/types'

/** 公開イベント一覧取得（公開済み、日付降順） */
export async function getPublishedEvents(): Promise<Event[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('is_published', true)
    .order('event_date', { ascending: false })

  if (error) {
    throw new Error(`公開イベント一覧の取得に失敗しました: ${error.message}`)
  }

  return data
}

/** 全イベント一覧取得（管理者用、日付降順） */
export async function getAllEvents(): Promise<Event[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('event_date', { ascending: false })

  if (error) {
    throw new Error(`イベント一覧の取得に失敗しました: ${error.message}`)
  }

  return data
}

/** イベント詳細取得 */
export async function getEvent(id: string): Promise<Event> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    throw new Error(`イベントの取得に失敗しました: ${error.message}`)
  }

  return data
}

/** イベント作成 */
export async function createEvent(data: EventInsert): Promise<Event> {
  const { data: event, error } = await supabase
    .from('events')
    .insert(data)
    .select()
    .single()

  if (error) {
    throw new Error(`イベントの作成に失敗しました: ${error.message}`)
  }

  return event
}

/** イベント更新 */
export async function updateEvent(id: string, data: EventUpdate): Promise<Event> {
  const { data: event, error } = await supabase
    .from('events')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`イベントの更新に失敗しました: ${error.message}`)
  }

  return event
}

/** イベント削除 */
export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', id)

  if (error) {
    throw new Error(`イベントの削除に失敗しました: ${error.message}`)
  }
}

/** イベントの確定済み参加者数取得 */
export async function getConfirmedParticipantCount(eventId: string): Promise<number> {
  const { data, error } = await supabase
    .from('reservations')
    .select('participant_count')
    .eq('event_id', eventId)
    .eq('status', 'confirmed')

  if (error) {
    throw new Error(`確定済み参加者数の取得に失敗しました: ${error.message}`)
  }

  return data.reduce((sum, row) => sum + (row.participant_count ?? 0), 0)
}
