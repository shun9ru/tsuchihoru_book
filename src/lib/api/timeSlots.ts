import { supabase } from '@/lib/supabase'
import type { EventTimeSlot, EventTimeSlotInsert } from '@/types'

/** イベントの時間割スロット一覧取得（sort_order順） */
export async function getTimeSlots(eventId: string): Promise<EventTimeSlot[]> {
  const { data, error } = await supabase
    .from('event_time_slots')
    .select('*')
    .eq('event_id', eventId)
    .order('sort_order')
  if (error) throw new Error(`時間割の取得に失敗しました: ${error.message}`)
  return data
}

/** 時間割スロット一括作成（既存削除→新規作成） */
export async function generateTimeSlots(
  eventId: string,
  startTime: string,  // "10:00"
  endTime: string,    // "17:00"
  intervalMinutes: number,
  capacityPerSlot: number,
  eventDateId?: string
): Promise<EventTimeSlot[]> {
  // 既存スロットを削除
  let deleteQuery = supabase
    .from('event_time_slots')
    .delete()
  if (eventDateId) {
    deleteQuery = deleteQuery.eq('event_date_id', eventDateId)
  } else {
    deleteQuery = deleteQuery.eq('event_id', eventId)
  }
  const { error: deleteError } = await deleteQuery
  if (deleteError) throw new Error(`既存スロットの削除に失敗しました: ${deleteError.message}`)

  // スロットを生成
  const slots: EventTimeSlotInsert[] = []
  const [startH, startM] = startTime.split(':').map(Number)
  const [endH, endM] = endTime.split(':').map(Number)
  let currentMinutes = startH * 60 + startM
  const endMinutes = endH * 60 + endM
  let order = 0

  while (currentMinutes + intervalMinutes <= endMinutes) {
    const slotStartH = String(Math.floor(currentMinutes / 60)).padStart(2, '0')
    const slotStartM = String(currentMinutes % 60).padStart(2, '0')
    const slotEndMinutes = currentMinutes + intervalMinutes
    const slotEndH = String(Math.floor(slotEndMinutes / 60)).padStart(2, '0')
    const slotEndM = String(slotEndMinutes % 60).padStart(2, '0')

    slots.push({
      event_id: eventId,
      start_time: `${slotStartH}:${slotStartM}`,
      end_time: `${slotEndH}:${slotEndM}`,
      capacity: capacityPerSlot,
      is_available: true,
      sort_order: order++,
      ...(eventDateId ? { event_date_id: eventDateId } : {}),
    })
    currentMinutes += intervalMinutes
  }

  if (slots.length === 0) throw new Error('有効なスロットが生成できません。時間範囲と間隔を確認してください。')

  const { data, error } = await supabase
    .from('event_time_slots')
    .insert(slots)
    .select()
  if (error) throw new Error(`スロットの作成に失敗しました: ${error.message}`)
  return data
}

/** 個別スロットの更新（定員変更、有効/無効切替） */
export async function updateTimeSlot(id: string, updates: { capacity?: number; is_available?: boolean }): Promise<EventTimeSlot> {
  const { data, error } = await supabase
    .from('event_time_slots')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(`スロットの更新に失敗しました: ${error.message}`)
  return data
}

/** スロット削除 */
export async function deleteTimeSlot(id: string): Promise<void> {
  const { error } = await supabase
    .from('event_time_slots')
    .delete()
    .eq('id', id)
  if (error) throw new Error(`スロットの削除に失敗しました: ${error.message}`)
}

/** スロットごとの確定済み参加者数を一括取得 */
export async function getSlotReservationCounts(eventId: string, eventDateId?: string): Promise<Record<string, number>> {
  let query = supabase
    .from('reservations')
    .select('time_slot_id, participant_count')
    .eq('event_id', eventId)
    .eq('status', 'confirmed')
    .not('time_slot_id', 'is', null)
  if (eventDateId) {
    query = query.eq('event_date_id', eventDateId)
  }
  const { data, error } = await query
  if (error) throw new Error(`スロット予約数の取得に失敗しました: ${error.message}`)

  const counts: Record<string, number> = {}
  for (const r of data) {
    if (r.time_slot_id) {
      counts[r.time_slot_id] = (counts[r.time_slot_id] || 0) + r.participant_count
    }
  }
  return counts
}

/** スロット付きで利用可能なスロット一覧（公開用：空きがあるもの） */
export async function getAvailableSlots(eventId: string, eventDateId?: string): Promise<Array<EventTimeSlot & { reserved_count: number; remaining: number }>> {
  async function fetchSlots(): Promise<EventTimeSlot[]> {
    if (eventDateId) {
      const { data, error } = await supabase
        .from('event_time_slots')
        .select('*')
        .eq('event_date_id', eventDateId)
        .order('sort_order')
      if (error) throw new Error(`時間割の取得に失敗しました: ${error.message}`)
      return data
    }
    return getTimeSlots(eventId)
  }

  const [slots, counts] = await Promise.all([
    fetchSlots(),
    getSlotReservationCounts(eventId, eventDateId),
  ])
  return slots
    .filter(s => s.is_available)
    .map(s => ({
      ...s,
      reserved_count: counts[s.id] || 0,
      remaining: s.capacity - (counts[s.id] || 0),
    }))
}
