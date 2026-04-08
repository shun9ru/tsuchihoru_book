import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Calendar, MapPin, Save, FileText } from 'lucide-react'
import { customersApi } from '@/lib/api'
import { Button, Card, Badge, LoadingSpinner, Textarea } from '@/components/ui'
import { RESERVATION_STATUS_LABELS } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import type { Customer } from '@/types'

interface ReservationWithEvent {
  id: string
  event_id: string
  name: string
  email: string
  status: string
  participant_count: number
  created_at: string
  events: {
    id: string
    title: string
    event_date: string
    start_time: string
    end_time: string
    location: string
  } | null
}

interface SurveyAnswerWithQuestion {
  id: string
  reservation_id: string
  answer_text: string | null
  answer_json: unknown
  survey_questions: {
    question_text: string
    question_type: string
  } | null
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [reservations, setReservations] = useState<ReservationWithEvent[]>([])
  const [surveyAnswers, setSurveyAnswers] = useState<SurveyAnswerWithQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [memo, setMemo] = useState('')
  const [memoSaving, setMemoSaving] = useState(false)
  const [memoSaved, setMemoSaved] = useState(false)

  const loadData = useCallback(async () => {
    if (!id) return
    try {
      const customerData = await customersApi.getCustomer(id)
      const [reservationData, answerData] = await Promise.all([
        customersApi.getCustomerReservations(id, customerData.email),
        customersApi.getCustomerSurveyAnswers(id, customerData.email),
      ])
      setCustomer(customerData)
      setReservations(reservationData as ReservationWithEvent[])
      setSurveyAnswers(answerData as SurveyAnswerWithQuestion[])
      setMemo(customerData.memo ?? '')
    } catch (err) {
      console.error('顧客データの取得に失敗しました:', err)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function saveMemo() {
    if (!id) return
    setMemoSaving(true)
    try {
      await customersApi.updateCustomer(id, { memo: memo || null })
      setMemoSaved(true)
      setTimeout(() => setMemoSaved(false), 2000)
    } catch (err) {
      console.error('メモの保存に失敗しました:', err)
    } finally {
      setMemoSaving(false)
    }
  }

  const statusVariant = (status: string) => {
    switch (status) {
      case 'confirmed': return 'success' as const
      case 'attended': return 'info' as const
      case 'cancelled': return 'default' as const
      case 'no_show': return 'danger' as const
      default: return 'default' as const
    }
  }

  // アンケート回答を予約IDでグループ化
  const answersByReservation = surveyAnswers.reduce<Record<string, SurveyAnswerWithQuestion[]>>((acc, a) => {
    if (!acc[a.reservation_id]) acc[a.reservation_id] = []
    acc[a.reservation_id].push(a)
    return acc
  }, {})

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="text-center text-gray-500">顧客が見つかりません</div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/customers')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
          <p className="text-sm text-gray-500">顧客カルテ</p>
        </div>
      </div>

      {/* Basic Info */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">基本情報</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <span className="text-xs font-medium text-gray-500">氏名</span>
            <p className="text-gray-900">{customer.name}</p>
          </div>
          <div>
            <span className="text-xs font-medium text-gray-500">メールアドレス</span>
            <p className="text-gray-900">{customer.email}</p>
          </div>
          <div>
            <span className="text-xs font-medium text-gray-500">都道府県</span>
            <p className="text-gray-900">{customer.prefecture ?? '-'}</p>
          </div>
          <div>
            <span className="text-xs font-medium text-gray-500">年代</span>
            <p className="text-gray-900">{customer.age_group ?? '-'}</p>
          </div>
          <div>
            <span className="text-xs font-medium text-gray-500">登録日</span>
            <p className="text-gray-900">{formatDate(customer.created_at)}</p>
          </div>
        </div>
      </Card>

      {/* Memo */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">管理者メモ</h2>
        <Textarea
          rows={4}
          placeholder="この顧客に関するメモを記入..."
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />
        <div className="mt-3 flex items-center gap-3">
          <Button size="sm" onClick={saveMemo} loading={memoSaving}>
            <Save className="mr-1 h-3.5 w-3.5" />
            保存
          </Button>
          {memoSaved && (
            <span className="text-sm text-green-600">保存しました</span>
          )}
        </div>
      </Card>

      {/* Participation History */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">参加履歴</h2>
          <Badge variant="info">{reservations.length}件</Badge>
        </div>

        {reservations.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-500">予約履歴がありません</p>
        ) : (
          <div className="space-y-3">
            {reservations.map((r) => {
              const answers = answersByReservation[r.id]
              return (
                <div key={r.id} className="rounded-lg border border-gray-200 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-gray-900">
                        {r.events?.title ?? '(イベント不明)'}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-500">
                        {r.events && (
                          <>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {formatDate(r.events.event_date)}
                              {' '}
                              {r.events.start_time.slice(0, 5)}〜{r.events.end_time.slice(0, 5)}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {r.events.location}
                            </span>
                          </>
                        )}
                        <span>{r.participant_count}名</span>
                      </div>
                    </div>
                    <Badge variant={statusVariant(r.status)}>
                      {RESERVATION_STATUS_LABELS[r.status] ?? r.status}
                    </Badge>
                  </div>

                  {/* Survey Answers */}
                  {answers && answers.length > 0 && (
                    <div className="mt-3 rounded-lg bg-gray-50 p-3">
                      <div className="mb-2 flex items-center gap-1 text-xs font-medium text-gray-500">
                        <FileText className="h-3 w-3" />
                        アンケート回答
                      </div>
                      <div className="space-y-1.5">
                        {answers.map((a) => (
                          <div key={a.id} className="text-sm">
                            <span className="font-medium text-gray-700">
                              {a.survey_questions?.question_text ?? '(質問不明)'}
                            </span>
                            <span className="ml-2 text-gray-600">
                              {a.answer_text
                                ? a.answer_text
                                : Array.isArray(a.answer_json)
                                  ? (a.answer_json as string[]).join(', ')
                                  : '-'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
