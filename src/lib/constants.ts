export const APP_NAME = 'イベント予約管理システム'

export const RESERVATION_STATUS_LABELS: Record<string, string> = {
  confirmed: '予約確定',
  cancelled: 'キャンセル',
  attended: '参加済',
  no_show: '無断欠席',
}

export const QUESTION_TYPE_LABELS: Record<string, string> = {
  single_choice: '単一選択',
  multiple_choice: '複数選択',
  free_text: '自由記述',
}

export const EMAIL_STATUS_LABELS: Record<string, string> = {
  draft: '下書き',
  sending: '送信中',
  sent: '送信完了',
  failed: '送信失敗',
}

export const SEND_STATUS_LABELS: Record<string, string> = {
  pending: '未送信',
  sent: '送信済',
  failed: '失敗',
}

export const WAITLIST_STATUS_LABELS: Record<string, string> = {
  waiting: 'キャンセル待ち',
  promoted: '繰り上げ済',
  cancelled: 'キャンセル',
}

export const REMINDER_TYPE_LABELS: Record<string, string> = {
  '3_days_before': '3日前',
  '1_day_before': '前日',
  'morning_of': '当日朝',
}

export const REMINDER_STATUS_LABELS: Record<string, string> = {
  pending: '未送信',
  sent: '送信済',
  failed: '失敗',
  skipped: 'スキップ',
}

export const SLOT_INTERVAL_OPTIONS = [
  { value: '15', label: '15分' },
  { value: '30', label: '30分' },
  { value: '45', label: '45分' },
  { value: '60', label: '60分' },
  { value: '90', label: '90分' },
  { value: '120', label: '120分' },
]
