import { supabase } from '@/lib/supabase'
import type { EventDate, EventDateInsert, EventDateUpdate } from '@/types'

/** イベントの開催日一覧取得 */
export async function getEventDates(eventId: string): Promise<EventDate[]> {
  const { data, error } = await supabase
    .from('event_dates')
    .select('*')
    .eq('event_id', eventId)
    .order('sort_order')
  if (error) throw new Error(`開催日の取得に失敗しました: ${error.message}`)
  return data
}

/** 開催日追加 */
export async function createEventDate(data: EventDateInsert): Promise<EventDate> {
  const { data: result, error } = await supabase
    .from('event_dates')
    .insert(data)
    .select()
    .single()
  if (error) throw new Error(`開催日の追加に失敗しました: ${error.message}`)
  return result
}

/** 開催日更新 */
export async function updateEventDate(id: string, data: EventDateUpdate): Promise<EventDate> {
  const { data: result, error } = await supabase
    .from('event_dates')
    .update(data)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(`開催日の更新に失敗しました: ${error.message}`)
  return result
}

/** 開催日削除 */
export async function deleteEventDate(id: string): Promise<void> {
  const { error } = await supabase
    .from('event_dates')
    .delete()
    .eq('id', id)
  if (error) throw new Error(`開催日の削除に失敗しました: ${error.message}`)
}

/** 開催日ごとの確定済み参加者数を一括取得 */
export async function getDateReservationCounts(eventId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('reservations')
    .select('event_date_id, participant_count')
    .eq('event_id', eventId)
    .eq('status', 'confirmed')
    .not('event_date_id', 'is', null)
  if (error) throw new Error(`日付別予約数の取得に失敗しました: ${error.message}`)

  const counts: Record<string, number> = {}
  for (const r of data) {
    if (r.event_date_id) {
      counts[r.event_date_id] = (counts[r.event_date_id] || 0) + r.participant_count
    }
  }
  return counts
}

/** 日付ごとの時間割スロット取得 */
export async function getTimeSlotsForDate(dateId: string) {
  const { data, error } = await supabase
    .from('event_time_slots')
    .select('*')
    .eq('event_date_id', dateId)
    .order('sort_order')
  if (error) throw new Error(`時間割の取得に失敗しました: ${error.message}`)
  return data
}
