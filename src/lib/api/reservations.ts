import { supabase } from '@/lib/supabase'
import type { Reservation } from '@/types'
import { getConfirmedParticipantCount } from './events'

/** イベントの予約一覧取得（管理者用） */
export async function getReservations(eventId: string): Promise<Reservation[]> {
  const { data, error } = await supabase
    .from('reservations')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`予約一覧の取得に失敗しました: ${error.message}`)
  }

  return data
}

/** 予約作成（定員チェック含む） */
export async function createReservation(data: {
  event_id: string
  name: string
  email: string
  phone: string
  participant_count: number
  note?: string
  agreed_to_caution: boolean
  caution_version: number
  answers?: Array<{ question_id: string; answer_text?: string; answer_json?: any }>
  time_slot_id?: string
  event_date_id?: string
  customer_id?: string
}): Promise<Reservation> {
  // 1. イベントの定員を取得
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('capacity')
    .eq('id', data.event_id)
    .single()

  if (eventError) {
    throw new Error(`イベント情報の取得に失敗しました: ${eventError.message}`)
  }

  // 2. 定員チェック
  if (data.time_slot_id) {
    // Check slot capacity
    const { data: slotReservations } = await supabase
      .from('reservations')
      .select('participant_count')
      .eq('time_slot_id', data.time_slot_id)
      .eq('status', 'confirmed')
    const slotCount = slotReservations?.reduce((sum, r) => sum + r.participant_count, 0) || 0

    const { data: slot } = await supabase
      .from('event_time_slots')
      .select('capacity')
      .eq('id', data.time_slot_id)
      .single()

    if (slot && slotCount + data.participant_count > slot.capacity) {
      throw new Error('選択した時間帯の定員に達しているため予約できません')
    }
  } else if (data.event_date_id) {
    // Check date-level capacity
    const { data: eventDate, error: dateError } = await supabase
      .from('event_dates')
      .select('capacity')
      .eq('id', data.event_date_id)
      .single()

    if (dateError) {
      throw new Error(`開催日情報の取得に失敗しました: ${dateError.message}`)
    }

    const { data: dateReservations } = await supabase
      .from('reservations')
      .select('participant_count')
      .eq('event_date_id', data.event_date_id)
      .eq('status', 'confirmed')
    const dateCount = dateReservations?.reduce((sum, r) => sum + r.participant_count, 0) || 0

    if (dateCount + data.participant_count > eventDate.capacity) {
      throw new Error('選択した日の定員に達しているため予約できません')
    }
  } else {
    // Original event-level capacity check
    const confirmedCount = await getConfirmedParticipantCount(data.event_id)

    if (confirmedCount + data.participant_count > event.capacity) {
      throw new Error('定員に達しているため予約できません')
    }
  }

  // 3. 予約を作成
  const { answers, ...reservationData } = data
  const { data: reservation, error: reservationError } = await supabase
    .from('reservations')
    .insert({
      event_id: reservationData.event_id,
      name: reservationData.name,
      email: reservationData.email,
      phone: reservationData.phone,
      participant_count: reservationData.participant_count,
      note: reservationData.note ?? null,
      agreed_to_caution: reservationData.agreed_to_caution,
      caution_version: reservationData.caution_version,
      time_slot_id: reservationData.time_slot_id ?? null,
      event_date_id: reservationData.event_date_id ?? null,
      customer_id: reservationData.customer_id ?? null,
      agreed_at: new Date().toISOString(),
      status: 'confirmed',
    })
    .select()
    .single()

  if (reservationError) {
    throw new Error(`予約の作成に失敗しました: ${reservationError.message}`)
  }

  // 5. アンケート回答を保存
  if (answers && answers.length > 0) {
    const answerRows = answers.map((a) => ({
      reservation_id: reservation.id,
      question_id: a.question_id,
      answer_text: a.answer_text ?? null,
      answer_json: a.answer_json ?? null,
    }))

    const { error: answersError } = await supabase
      .from('survey_answers')
      .insert(answerRows)

    if (answersError) {
      // 回答の保存に失敗した場合、予約自体は作成済みなのでログだけ残す
      console.error('アンケート回答の保存に失敗しました:', answersError.message)
    }
  }

  return reservation
}

/** 予約ステータス更新 */
export async function updateReservationStatus(
  id: string,
  status: string
): Promise<Reservation> {
  const { data, error } = await supabase
    .from('reservations')
    .update({ status })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`予約ステータスの更新に失敗しました: ${error.message}`)
  }

  return data
}

/** 予約取得 */
export async function getReservation(id: string): Promise<Reservation> {
  const { data, error } = await supabase
    .from('reservations')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    throw new Error(`予約の取得に失敗しました: ${error.message}`)
  }

  return data
}

/** 予約のメールアドレス一覧取得（一斉メール用） */
export async function getReservationEmails(
  eventId: string
): Promise<Array<{ id: string; email: string; name: string }>> {
  const { data, error } = await supabase
    .from('reservations')
    .select('id, email, name')
    .eq('event_id', eventId)
    .eq('status', 'confirmed')

  if (error) {
    throw new Error(`予約メールアドレス一覧の取得に失敗しました: ${error.message}`)
  }

  return data
}
