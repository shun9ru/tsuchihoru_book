import { supabase } from '@/lib/supabase'
import type { EventStats } from '@/types'
import { getEvent, getConfirmedParticipantCount } from './events'

/** イベントの統計情報取得 */
export async function getEventStats(eventId: string): Promise<EventStats> {
  // 並列で各種データを取得
  const [event, confirmedCount, reservationsResult] = await Promise.all([
    getEvent(eventId),
    getConfirmedParticipantCount(eventId),
    supabase
      .from('reservations')
      .select('id', { count: 'exact' })
      .eq('event_id', eventId)
      .eq('status', 'confirmed'),
  ])

  if (reservationsResult.error) {
    throw new Error(
      `予約数の取得に失敗しました: ${reservationsResult.error.message}`
    )
  }

  // 確定済み予約のアンケート回答数を取得
  const reservationIds = (reservationsResult.data ?? []).map((r) => r.id)

  let surveyResponseCount = 0
  if (reservationIds.length > 0) {
    // アンケート回答がある予約の数をカウント（ユニークなreservation_id）
    const { data: answeredReservations, error: ansError } = await supabase
      .from('survey_answers')
      .select('reservation_id')
      .in('reservation_id', reservationIds)

    if (ansError) {
      throw new Error(
        `アンケート回答数の取得に失敗しました: ${ansError.message}`
      )
    }

    const uniqueReservationIds = new Set(
      answeredReservations.map((a) => a.reservation_id)
    )
    surveyResponseCount = uniqueReservationIds.size
  }

  return {
    totalReservations: reservationsResult.count ?? 0,
    totalParticipants: confirmedCount,
    remainingCapacity: event.capacity - confirmedCount,
    surveyResponseCount,
  }
}

/** 日別予約数取得 */
export async function getDailyReservationCounts(
  eventId: string
): Promise<Array<{ date: string; count: number }>> {
  const { data, error } = await supabase
    .from('reservations')
    .select('created_at')
    .eq('event_id', eventId)
    .eq('status', 'confirmed')
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`日別予約数の取得に失敗しました: ${error.message}`)
  }

  // 日付ごとに集計
  const countMap = new Map<string, number>()

  for (const row of data) {
    const date = row.created_at.split('T')[0]
    countMap.set(date, (countMap.get(date) ?? 0) + 1)
  }

  return Array.from(countMap.entries()).map(([date, count]) => ({
    date,
    count,
  }))
}
