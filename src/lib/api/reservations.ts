import { supabase } from '@/lib/supabase'
import type { Reservation } from '@/types'
import { getConfirmedParticipantCount } from './events'

/** イベントの予約一覧取得（管理者用・時間帯情報付き） */
export async function getReservations(eventId: string) {
  const { data: reservations, error } = await supabase
    .from('reservations')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`予約一覧の取得に失敗しました: ${error.message}`)
  }

  // タイムスロットと日程の情報を別途取得してマージ
  const slotIds = [...new Set(reservations.filter(r => r.time_slot_id).map(r => r.time_slot_id!))]
  const dateIds = [...new Set(reservations.filter(r => r.event_date_id).map(r => r.event_date_id!))]

  let slotsMap: Record<string, { start_time: string; end_time: string }> = {}
  let datesMap: Record<string, { event_date: string; start_time: string; end_time: string | null }> = {}

  if (slotIds.length > 0) {
    const { data: slots } = await supabase
      .from('event_time_slots')
      .select('id, start_time, end_time')
      .in('id', slotIds)
    if (slots) {
      slotsMap = Object.fromEntries(slots.map(s => [s.id, { start_time: s.start_time, end_time: s.end_time }]))
    }
  }

  if (dateIds.length > 0) {
    const { data: dates } = await supabase
      .from('event_dates')
      .select('id, event_date, start_time, end_time')
      .in('id', dateIds)
    if (dates) {
      datesMap = Object.fromEntries(dates.map(d => [d.id, { event_date: d.event_date, start_time: d.start_time, end_time: d.end_time }]))
    }
  }

  return reservations.map(r => ({
    ...r,
    event_time_slots: r.time_slot_id ? slotsMap[r.time_slot_id] || null : null,
    event_dates: r.event_date_id ? datesMap[r.event_date_id] || null : null,
  }))
}

export type ReservationWithSlot = Awaited<ReturnType<typeof getReservations>>[number]

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
      status: 'pending_approval',
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

  // 管理者へ新規予約通知メールを送信（非ブロッキング：予約完了を待たせない）
  ;(async () => {
    try {
      const { data: eventInfo } = await supabase
        .from('events')
        .select('title, event_date')
        .eq('id', data.event_id)
        .single()

      const { data: admins } = await supabase
        .from('users')
        .select('email')
        .eq('role', 'admin')

      if (admins && admins.length > 0) {
        await Promise.allSettled(
          admins.map(admin =>
            supabase.functions.invoke('send-email', {
              body: {
                type: 'single',
                to: admin.email,
                subject: `【新規予約】${eventInfo?.title || ''} - ${data.name}様`,
                body: `新しい予約が入りました。承認をお願いします。\n\nイベント: ${eventInfo?.title || ''}\n予約者: ${data.name}\nメール: ${data.email}\n電話: ${data.phone}\n参加人数: ${data.participant_count}名\n\n管理画面から承認・却下を行ってください。`,
              },
            })
          )
        )
      }
    } catch (e) {
      console.error('管理者通知メールの送信に失敗:', e)
    }
  })()

  return reservation
}

/** 予約ステータス更新（承認/却下時にメール通知付き） */
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

  // 承認/却下時に予約者へメール通知（非ブロッキング）
  if (status === 'confirmed' || status === 'rejected') {
    ;(async () => {
      try {
        const { data: eventInfo } = await supabase
          .from('events')
          .select('title, event_date, start_time, end_time, location')
          .eq('id', data.event_id)
          .single()

        const subject = status === 'confirmed'
          ? `【予約確定】${eventInfo?.title || ''}`
          : `【予約についてのお知らせ】${eventInfo?.title || ''}`

        const body = status === 'confirmed'
          ? `${data.name}様\n\nご予約が確定しました。\n\nイベント: ${eventInfo?.title || ''}\n日時: ${eventInfo?.event_date || ''} ${eventInfo?.start_time || ''}〜${eventInfo?.end_time || ''}\n場所: ${eventInfo?.location || ''}\n参加人数: ${data.participant_count}名\n\nご参加をお待ちしております。`
          : `${data.name}様\n\n誠に申し訳ございませんが、以下のご予約を承認できませんでした。\n\nイベント: ${eventInfo?.title || ''}\n日時: ${eventInfo?.event_date || ''}\n\nご不明な点がございましたらお気軽にお問い合わせください。`

        await supabase.functions.invoke('send-email', {
          body: { type: 'single', to: data.email, subject, body },
        })
      } catch (e) {
        console.error('予約者への通知メール送信に失敗:', e)
      }
    })()
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

/** 予約に紐づくアンケート回答取得（質問情報付き） */
export async function getReservationSurveyAnswers(reservationId: string) {
  const { data, error } = await supabase
    .from('survey_answers')
    .select('*, survey_questions(question_text, question_type, options_json)')
    .eq('reservation_id', reservationId)

  if (error) {
    throw new Error(`アンケート回答の取得に失敗しました: ${error.message}`)
  }

  return data
}

/** メールアドレスで通算参加回数を取得（confirmed + attended） */
export async function getParticipationCount(email: string): Promise<number> {
  const { count, error } = await supabase
    .from('reservations')
    .select('*', { count: 'exact', head: true })
    .eq('email', email)
    .in('status', ['confirmed', 'attended'])

  if (error) {
    throw new Error(`参加回数の取得に失敗しました: ${error.message}`)
  }

  return count ?? 0
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
