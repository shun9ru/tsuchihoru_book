export const APP_NAME = 'イベント予約管理システム'

export const RESERVATION_STATUS_LABELS: Record<string, string> = {
  pending_approval: '承認待ち',
  confirmed: '予約確定',
  rejected: '却下',
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

export const AGE_GROUP_OPTIONS = [
  { value: '未就学児', label: '未就学児' },
  { value: '小学生', label: '小学生' },
  { value: '中学生', label: '中学生' },
  { value: '高校生', label: '高校生' },
  { value: '20代', label: '20代' },
  { value: '30代', label: '30代' },
  { value: '40代', label: '40代' },
  { value: '50代', label: '50代' },
  { value: '60代', label: '60代' },
  { value: '70代以上', label: '70代以上' },
]

export const PREFECTURE_OPTIONS = [
  { value: '北海道', label: '北海道' },
  { value: '青森県', label: '青森県' },
  { value: '岩手県', label: '岩手県' },
  { value: '宮城県', label: '宮城県' },
  { value: '秋田県', label: '秋田県' },
  { value: '山形県', label: '山形県' },
  { value: '福島県', label: '福島県' },
  { value: '茨城県', label: '茨城県' },
  { value: '栃木県', label: '栃木県' },
  { value: '群馬県', label: '群馬県' },
  { value: '埼玉県', label: '埼玉県' },
  { value: '千葉県', label: '千葉県' },
  { value: '東京都', label: '東京都' },
  { value: '神奈川県', label: '神奈川県' },
  { value: '新潟県', label: '新潟県' },
  { value: '富山県', label: '富山県' },
  { value: '石川県', label: '石川県' },
  { value: '福井県', label: '福井県' },
  { value: '山梨県', label: '山梨県' },
  { value: '長野県', label: '長野県' },
  { value: '岐阜県', label: '岐阜県' },
  { value: '静岡県', label: '静岡県' },
  { value: '愛知県', label: '愛知県' },
  { value: '三重県', label: '三重県' },
  { value: '滋賀県', label: '滋賀県' },
  { value: '京都府', label: '京都府' },
  { value: '大阪府', label: '大阪府' },
  { value: '兵庫県', label: '兵庫県' },
  { value: '奈良県', label: '奈良県' },
  { value: '和歌山県', label: '和歌山県' },
  { value: '鳥取県', label: '鳥取県' },
  { value: '島根県', label: '島根県' },
  { value: '岡山県', label: '岡山県' },
  { value: '広島県', label: '広島県' },
  { value: '山口県', label: '山口県' },
  { value: '徳島県', label: '徳島県' },
  { value: '香川県', label: '香川県' },
  { value: '愛媛県', label: '愛媛県' },
  { value: '高知県', label: '高知県' },
  { value: '福岡県', label: '福岡県' },
  { value: '佐賀県', label: '佐賀県' },
  { value: '長崎県', label: '長崎県' },
  { value: '熊本県', label: '熊本県' },
  { value: '大分県', label: '大分県' },
  { value: '宮崎県', label: '宮崎県' },
  { value: '鹿児島県', label: '鹿児島県' },
  { value: '沖縄県', label: '沖縄県' },
]

export const SLOT_INTERVAL_OPTIONS = [
  { value: '15', label: '15分' },
  { value: '30', label: '30分' },
  { value: '45', label: '45分' },
  { value: '60', label: '60分' },
  { value: '90', label: '90分' },
  { value: '120', label: '120分' },
]
