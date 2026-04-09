/**
 * 日付を日本語形式（YYYY年MM月DD日）にフォーマットする
 */
export function formatDate(date: string): string {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = d.getMonth() + 1
  const day = d.getDate()
  return `${year}年${month}月${day}日`
}

/**
 * 時間をHH:MM形式にフォーマットする
 */
export function formatTime(time: string): string {
  // "HH:MM:SS" or "HH:MM" -> "HH:MM"
  return time.slice(0, 5)
}

/**
 * ISO日時文字列を日本語形式にフォーマットする
 */
export function formatDateTime(date: string): string {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = d.getMonth() + 1
  const day = d.getDate()
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${year}年${month}月${day}日 ${hours}:${minutes}`
}

/**
 * 金額を日本円形式（¥1,000）にフォーマットする
 */
export function formatCurrency(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`
}

/**
 * 現在が予約受付期間内かどうかを判定する
 */
export function isWithinReservationPeriod(
  start: string | null,
  end: string | null
): boolean {
  const now = new Date()

  if (start) {
    const startDate = new Date(start)
    if (now < startDate) return false
  }

  if (end) {
    const endDate = new Date(end)
    if (now > endDate) return false
  }

  return true
}

/**
 * 残りの定員数を計算する
 */
export function getRemainingCapacity(
  capacity: number,
  currentCount: number
): number {
  return Math.max(0, capacity - currentCount)
}

/**
 * 予約の時間帯ラベルを取得する
 * タイムスロット・日程・イベント本体の情報を優先順位で判定
 */
export function getSlotLabel(
  r: {
    event_time_slots?: { start_time: string; end_time: string } | null
    event_dates?: { event_date: string; start_time: string; end_time: string | null } | null
  },
  event: { event_date: string; start_time: string; end_time: string } | null
): string {
  // タイムスロット + 日程がある場合
  if (r.event_time_slots && r.event_dates) {
    return `${formatDate(r.event_dates.event_date)} ${formatTime(r.event_time_slots.start_time)}〜${formatTime(r.event_time_slots.end_time)}`
  }
  // タイムスロットのみ
  if (r.event_time_slots) {
    const dateStr = event ? formatDate(event.event_date) : ''
    return `${dateStr} ${formatTime(r.event_time_slots.start_time)}〜${formatTime(r.event_time_slots.end_time)}`
  }
  // 日程のみ
  if (r.event_dates) {
    const d = r.event_dates
    return `${formatDate(d.event_date)} ${formatTime(d.start_time)}${d.end_time ? `〜${formatTime(d.end_time)}` : ''}`
  }
  // どちらもない場合はイベント本体の日時
  if (event) {
    return `${formatDate(event.event_date)} ${formatTime(event.start_time)}〜${formatTime(event.end_time)}`
  }
  return '-'
}

/**
 * クラス名を結合するユーティリティ
 */
export function cn(
  ...classes: (string | undefined | null | false)[]
): string {
  return classes.filter(Boolean).join(' ')
}
