import { supabase } from '@/lib/supabase'
import type { Waitlist, WaitlistInsert, Reservation } from '@/types'

/** キャンセル待ち一覧取得（イベント別、waiting のみ、created_at昇順） */
export async function getWaitlist(eventId: string): Promise<Waitlist[]> {
  const { data, error } = await supabase
    .from('waitlists')
    .select('*')
    .eq('event_id', eventId)
    .eq('status', 'waiting')
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`キャンセル待ち一覧の取得に失敗しました: ${error.message}`)
  }

  return data
}

/** キャンセル待ち登録 */
export async function createWaitlistEntry(data: WaitlistInsert): Promise<Waitlist> {
  const { data: entry, error } = await supabase
    .from('waitlists')
    .insert({
      ...data,
      status: 'waiting',
    })
    .select()
    .single()

  if (error) {
    throw new Error(`キャンセル待ち登録に失敗しました: ${error.message}`)
  }

  return entry
}

/** キャンセル待ち繰り上げ（statusをpromoted, promoted_atを設定、新規reservationを作成） */
export async function promoteWaitlistEntry(
  waitlistId: string,
  eventId: string,
  cautionVersion: number
): Promise<Reservation> {
  // 1. キャンセル待ちエントリを取得
  const { data: entry, error: fetchError } = await supabase
    .from('waitlists')
    .select('*')
    .eq('id', waitlistId)
    .single()

  if (fetchError) {
    throw new Error(`キャンセル待ちエントリの取得に失敗しました: ${fetchError.message}`)
  }

  // 2. キャンセル待ちステータスを promoted に更新
  const { error: updateError } = await supabase
    .from('waitlists')
    .update({
      status: 'promoted',
      promoted_at: new Date().toISOString(),
    })
    .eq('id', waitlistId)

  if (updateError) {
    throw new Error(`キャンセル待ちの繰り上げに失敗しました: ${updateError.message}`)
  }

  // 3. 新規予約を作成
  const { data: reservation, error: reservationError } = await supabase
    .from('reservations')
    .insert({
      event_id: eventId,
      name: entry.name,
      email: entry.email,
      phone: entry.phone,
      participant_count: entry.participant_count,
      note: entry.note,
      status: 'confirmed',
      agreed_to_caution: true,
      caution_version: cautionVersion,
      agreed_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (reservationError) {
    throw new Error(`繰り上げ予約の作成に失敗しました: ${reservationError.message}`)
  }

  return reservation
}

/** キャンセル待ちキャンセル */
export async function cancelWaitlistEntry(id: string): Promise<void> {
  const { error } = await supabase
    .from('waitlists')
    .update({ status: 'cancelled' })
    .eq('id', id)

  if (error) {
    throw new Error(`キャンセル待ちのキャンセルに失敗しました: ${error.message}`)
  }
}

/** キャンセル待ち件数取得 */
export async function getWaitlistCount(eventId: string): Promise<number> {
  const { count, error } = await supabase
    .from('waitlists')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('status', 'waiting')

  if (error) {
    throw new Error(`キャンセル待ち件数の取得に失敗しました: ${error.message}`)
  }

  return count ?? 0
}
