import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Calendar, MapPin, Save, FileText, CheckCircle2, XCircle, Hash, ClipboardCheck, Plus, Pencil, Trash2, X, BookOpen, Ticket } from 'lucide-react'
import { customersApi, customerActivitiesApi } from '@/lib/api'
import { Button, Card, Badge, LoadingSpinner, Textarea, Input } from '@/components/ui'
import { RESERVATION_STATUS_LABELS } from '@/lib/constants'
import { formatDate, formatDateTime } from '@/lib/utils'
import type { Customer, CustomerActivity } from '@/types'

interface ReservationWithEvent {
  id: string
  event_id: string
  name: string
  email: string
  status: string
  participant_count: number
  created_at: string
  agreed_to_caution: boolean
  agreed_at: string | null
  caution_version: number | null
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

  // Activity history
  const [activities, setActivities] = useState<CustomerActivity[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [activityForm, setActivityForm] = useState({
    activity_date: new Date().toISOString().slice(0, 10),
    title: '',
    plan: '',
    memo: '',
  })
  const [activitySaving, setActivitySaving] = useState(false)

  function resetActivityForm() {
    setActivityForm({
      activity_date: new Date().toISOString().slice(0, 10),
      title: '',
      plan: '',
      memo: '',
    })
  }

  const loadData = useCallback(async () => {
    if (!id) return
    try {
      const customerData = await customersApi.getCustomer(id)
      const [resResult, ansResult, actResult] = await Promise.allSettled([
        customersApi.getCustomerReservations(id, customerData.email),
        customersApi.getCustomerSurveyAnswers(id, customerData.email),
        customerActivitiesApi.getActivities(id),
      ])
      setCustomer(customerData)
      setReservations(resResult.status === 'fulfilled' ? resResult.value as ReservationWithEvent[] : [])
      setSurveyAnswers(ansResult.status === 'fulfilled' ? ansResult.value as SurveyAnswerWithQuestion[] : [])
      setActivities(actResult.status === 'fulfilled' ? actResult.value : [])
      setMemo(customerData.memo ?? '')

      if (actResult.status === 'rejected') console.warn('活動履歴の取得をスキップ:', actResult.reason)
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

  async function handleAddActivity() {
    if (!id || !activityForm.title.trim()) return
    setActivitySaving(true)
    try {
      const created = await customerActivitiesApi.createActivity({
        customer_id: id,
        activity_date: activityForm.activity_date,
        title: activityForm.title.trim(),
        plan: activityForm.plan.trim() || null,
        memo: activityForm.memo.trim() || null,
      })
      setActivities(prev => [created, ...prev])
      resetActivityForm()
      setShowAddForm(false)
    } catch (err) {
      console.error('活動履歴の追加に失敗しました:', err)
    } finally {
      setActivitySaving(false)
    }
  }

  async function handleUpdateActivity() {
    if (!editingId || !activityForm.title.trim()) return
    setActivitySaving(true)
    try {
      const updated = await customerActivitiesApi.updateActivity(editingId, {
        activity_date: activityForm.activity_date,
        title: activityForm.title.trim(),
        plan: activityForm.plan.trim() || null,
        memo: activityForm.memo.trim() || null,
      })
      setActivities(prev => prev.map(a => a.id === editingId ? updated : a))
      resetActivityForm()
      setEditingId(null)
    } catch (err) {
      console.error('活動履歴の更新に失敗しました:', err)
    } finally {
      setActivitySaving(false)
    }
  }

  async function handleDeleteActivity(activityId: string) {
    if (!confirm('この活動履歴を削除しますか？')) return
    try {
      await customerActivitiesApi.deleteActivity(activityId)
      setActivities(prev => prev.filter(a => a.id !== activityId))
    } catch (err) {
      console.error('活動履歴の削除に失敗しました:', err)
    }
  }

  function startEdit(activity: CustomerActivity) {
    setEditingId(activity.id)
    setShowAddForm(false)
    setActivityForm({
      activity_date: activity.activity_date,
      title: activity.title,
      plan: activity.plan ?? '',
      memo: activity.memo ?? '',
    })
  }

  function cancelEdit() {
    setEditingId(null)
    resetActivityForm()
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

  // 統合タイムライン: 予約 + 手動活動履歴を日付降順でマージ
  type TimelineItem =
    | { type: 'reservation'; date: string; data: ReservationWithEvent }
    | { type: 'activity'; date: string; data: CustomerActivity }

  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [
      ...reservations.map(r => ({
        type: 'reservation' as const,
        date: r.events?.event_date ?? r.created_at,
        data: r,
      })),
      ...activities.map(a => ({
        type: 'activity' as const,
        date: a.activity_date,
        data: a,
      })),
    ]
    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    return items
  }, [reservations, activities])

  // 通算参加回数: 確定/参加済の予約 + 手動活動履歴
  const totalParticipationCount =
    reservations.filter(r => r.status === 'confirmed' || r.status === 'attended').length
    + activities.length

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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
          <div>
            <span className="text-xs font-medium text-gray-500">通算参加回数</span>
            <p className="flex items-center gap-1.5 text-lg font-bold text-blue-600">
              <Hash className="h-4 w-4" />
              {totalParticipationCount}回
            </p>
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

      {/* Unified Timeline */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">参加・活動履歴</h2>
            <Badge variant="info">{timeline.length}件</Badge>
          </div>
          {!showAddForm && !editingId && (
            <Button
              size="sm"
              onClick={() => { setShowAddForm(true); resetActivityForm() }}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              手動で追加
            </Button>
          )}
        </div>

        {/* Add / Edit Form */}
        {(showAddForm || editingId) && (
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-blue-900">
                {editingId ? '履歴を編集' : '過去の参加記録を追加'}
              </h3>
              <button
                onClick={() => { editingId ? cancelEdit() : setShowAddForm(false) }}
                className="text-blue-400 hover:text-blue-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    日付 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="date"
                    value={activityForm.activity_date}
                    onChange={(e) => setActivityForm(f => ({ ...f, activity_date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    イベント名 / タイトル <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    placeholder="例: 土堀り体験会 第3回"
                    value={activityForm.title}
                    onChange={(e) => setActivityForm(f => ({ ...f, title: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">体験プラン</label>
                <Input
                  type="text"
                  placeholder="例: 親子コース、午前の部"
                  value={activityForm.plan}
                  onChange={(e) => setActivityForm(f => ({ ...f, plan: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">会話メモ / 備考</label>
                <Textarea
                  rows={3}
                  placeholder="お客様との会話内容や気づきを自由に記録..."
                  value={activityForm.memo}
                  onChange={(e) => setActivityForm(f => ({ ...f, memo: e.target.value }))}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={editingId ? handleUpdateActivity : handleAddActivity}
                  loading={activitySaving}
                  disabled={!activityForm.title.trim() || !activityForm.activity_date}
                >
                  <Save className="mr-1 h-3.5 w-3.5" />
                  {editingId ? '更新' : '保存'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { editingId ? cancelEdit() : setShowAddForm(false) }}
                >
                  キャンセル
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Timeline List */}
        {timeline.length === 0 && !showAddForm ? (
          <p className="py-4 text-center text-sm text-gray-500">
            履歴がありません。「手動で追加」から過去の参加記録を登録できます。
          </p>
        ) : (
          <div className="space-y-3">
            {timeline.map((item) => {
              if (item.type === 'activity') {
                const activity = item.data
                return (
                  <div
                    key={`act-${activity.id}`}
                    className="rounded-lg border border-gray-200 p-4 transition-colors hover:border-gray-300"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="default">
                            <BookOpen className="mr-1 inline h-3 w-3" />
                            手動登録
                          </Badge>
                          <span className="flex items-center gap-1 text-sm text-gray-500">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDate(activity.activity_date)}
                          </span>
                        </div>
                        <p className="mt-1 font-medium text-gray-900">{activity.title}</p>
                        {activity.plan && (
                          <p className="mt-1 text-sm text-gray-600">
                            <span className="font-medium text-gray-500">プラン:</span> {activity.plan}
                          </p>
                        )}
                        {activity.memo && (
                          <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">
                            <span className="font-medium text-gray-500">メモ:</span> {activity.memo}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          onClick={() => startEdit(activity)}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                          title="編集"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteActivity(activity.id)}
                          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                          title="削除"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              }

              // Reservation item
              const r = item.data
              const answers = answersByReservation[r.id]
              return (
                <div key={`res-${r.id}`} className="rounded-lg border border-gray-200 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="info">
                          <Ticket className="mr-1 inline h-3 w-3" />
                          予約
                        </Badge>
                        <Badge variant={statusVariant(r.status)}>
                          {RESERVATION_STATUS_LABELS[r.status] ?? r.status}
                        </Badge>
                      </div>
                      <p className="mt-1 font-medium text-gray-900">
                        {r.events?.title ?? '(イベント不明)'}
                      </p>
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
                  </div>

                  {/* Caution Agreement */}
                  <div className="mt-3 rounded-lg bg-gray-50 p-3">
                    <div className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-500">
                      <ClipboardCheck className="h-3 w-3" />
                      注意事項の承諾
                    </div>
                    {r.agreed_to_caution ? (
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          承諾済み
                        </span>
                        {r.agreed_at && (
                          <span className="text-gray-500">{formatDateTime(r.agreed_at)}</span>
                        )}
                        {r.caution_version && (
                          <span className="text-gray-500">v{r.caution_version}</span>
                        )}
                      </div>
                    ) : (
                      <span className="flex items-center gap-1 text-sm text-gray-400">
                        <XCircle className="h-3.5 w-3.5" />
                        未承諾
                      </span>
                    )}
                  </div>

                  {/* Survey Answers */}
                  {answers && answers.length > 0 && (
                    <div className="mt-2 rounded-lg bg-gray-50 p-3">
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
