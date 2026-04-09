import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import EventTabs from '@/components/admin/EventTabs'
import {
  ArrowLeft,
  Users,
  FileText,
  Mail,
  CheckCircle2,
  XCircle,
  Download,
  Search,
  Eye,
  Hash,
  ClipboardCheck,
  MapPin,
  Calendar,
  BookOpen,
  ExternalLink,
  User,
  StickyNote,
} from 'lucide-react'
import { eventsApi, reservationsApi, waitlistsApi, customersApi, customerActivitiesApi } from '@/lib/api'
import { Button, Card, Badge, LoadingSpinner, EmptyState, Modal } from '@/components/ui'
import { formatDate, formatTime, formatDateTime, getSlotLabel } from '@/lib/utils'
import { RESERVATION_STATUS_LABELS } from '@/lib/constants'
import { downloadCSV } from '@/lib/csv'
import type { Event, ReservationStatus, Customer, CustomerActivity } from '@/types'
import type { ReservationWithSlot } from '@/lib/api/reservations'

interface SurveyAnswerDetail {
  id: string
  answer_text: string | null
  answer_json: unknown
  survey_questions: {
    question_text: string
    question_type: string
    options_json: unknown
  } | null
}

interface PastReservation {
  id: string
  event_id: string
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

interface ReservationDetail {
  reservation: ReservationWithSlot
  surveyAnswers: SurveyAnswerDetail[]
  participationCount: number
  customer: Customer | null
  activities: CustomerActivity[]
  pastReservations: PastReservation[]
}

const STATUS_BADGE_VARIANT: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'default'> = {
  pending_approval: 'warning',
  confirmed: 'success',
  rejected: 'danger',
  cancelled: 'danger',
  attended: 'info',
  no_show: 'warning',
}

const STATUS_OPTIONS: ReservationStatus[] = ['pending_approval', 'confirmed', 'rejected', 'cancelled', 'attended', 'no_show']

export default function ReservationListPage() {
  const { id: eventId } = useParams<{ id: string }>()
  const [event, setEvent] = useState<Event | null>(null)
  const [reservations, setReservations] = useState<ReservationWithSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmedParticipants, setConfirmedParticipants] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [waitlistCount, setWaitlistCount] = useState(0)
  const [waitlistNotification, setWaitlistNotification] = useState<string | null>(null)
  const [detail, setDetail] = useState<ReservationDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  async function openDetail(reservation: ReservationWithSlot) {
    setDetailLoading(true)
    setDetail({
      reservation,
      surveyAnswers: [],
      participationCount: 0,
      customer: null,
      activities: [],
      pastReservations: [],
    })
    try {
      // 各APIを個別にエラーハンドリング（1つ失敗しても他は表示する）
      const [answersResult, countResult, customerResult] = await Promise.allSettled([
        reservationsApi.getReservationSurveyAnswers(reservation.id),
        reservationsApi.getParticipationCount(reservation.email),
        reservation.customer_id
          ? customersApi.getCustomer(reservation.customer_id)
          : customersApi.getCustomerByEmail(reservation.email),
      ])

      const answers = answersResult.status === 'fulfilled' ? answersResult.value as SurveyAnswerDetail[] : []
      const count = countResult.status === 'fulfilled' ? countResult.value : 0
      const customer = customerResult.status === 'fulfilled' ? customerResult.value : null

      console.log('[Detail] customer_id:', reservation.customer_id, 'email:', reservation.email)
      console.log('[Detail] customer found:', customer)
      console.log('[Detail] answers:', answers.length, 'count:', count)

      if (answersResult.status === 'rejected') console.error('アンケート取得失敗:', answersResult.reason)
      if (countResult.status === 'rejected') console.error('参加回数取得失敗:', countResult.reason)
      if (customerResult.status === 'rejected') console.error('顧客情報取得失敗:', customerResult.reason)

      // 顧客が見つかれば活動履歴 + 過去の予約も取得
      let activities: CustomerActivity[] = []
      let pastReservations: PastReservation[] = []
      if (customer) {
        const [actResult, resResult] = await Promise.allSettled([
          customerActivitiesApi.getActivities(customer.id),
          customersApi.getCustomerReservations(customer.id, customer.email),
        ])
        activities = actResult.status === 'fulfilled' ? actResult.value : []
        pastReservations = resResult.status === 'fulfilled'
          ? (resResult.value as PastReservation[]).filter(r => r.id !== reservation.id)
          : []
      }

      setDetail({
        reservation,
        surveyAnswers: answers,
        participationCount: count,
        customer,
        activities,
        pastReservations,
      })
    } catch (err) {
      console.error('詳細情報の取得に失敗しました:', err)
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => {
    if (eventId) {
      loadData(eventId)
    }
  }, [eventId])

  async function loadData(id: string) {
    try {
      const [eventData, reservationData, participantCount, wCount] = await Promise.all([
        eventsApi.getEvent(id),
        reservationsApi.getReservations(id),
        eventsApi.getConfirmedParticipantCount(id),
        waitlistsApi.getWaitlistCount(id),
      ])
      setEvent(eventData)
      setReservations(reservationData)
      setConfirmedParticipants(participantCount)
      setWaitlistCount(wCount)
    } catch (err) {
      console.error('データの読み込みに失敗しました:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredReservations = useMemo(() => {
    return reservations.filter(r => {
      // Status filter
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      // Search filter (name, email, phone)
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        return r.name.toLowerCase().includes(q) ||
               r.email.toLowerCase().includes(q) ||
               r.phone.includes(q)
      }
      return true
    })
  }, [reservations, searchQuery, statusFilter])

  function handleExportCSV() {
    const headers = ['氏名', 'メールアドレス', '電話番号', '参加人数', '予約時間帯', 'ステータス', '備考', '予約日時']
    const rows = filteredReservations.map(r => [
      r.name,
      r.email,
      r.phone,
      String(r.participant_count),
      getSlotLabel(r, event),
      RESERVATION_STATUS_LABELS[r.status] || r.status,
      r.note || '',
      formatDateTime(r.created_at),
    ])
    const eventTitle = event?.title || 'event'
    downloadCSV(`${eventTitle}_予約者一覧.csv`, headers, rows)
  }

  async function handleStatusChange(reservationId: string, newStatus: string) {
    try {
      const updated = await reservationsApi.updateReservationStatus(reservationId, newStatus)
      setReservations((prev) =>
        prev.map((r) => (r.id === reservationId ? { ...r, status: updated.status } : r))
      )
      // Recalculate confirmed participants
      if (eventId) {
        const [count, wCount] = await Promise.all([
          eventsApi.getConfirmedParticipantCount(eventId),
          waitlistsApi.getWaitlistCount(eventId),
        ])
        setConfirmedParticipants(count)
        setWaitlistCount(wCount)

        // Show notification if cancelled and there are waitlist entries
        if (newStatus === 'cancelled' && wCount > 0) {
          setWaitlistNotification('キャンセル待ちの方がいます。繰り上げを確認してください。')
        }
      }
    } catch (err) {
      console.error('ステータスの更新に失敗しました:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!event) {
    return (
      <EmptyState
        icon={Users}
        title="イベントが見つかりません"
      />
    )
  }

  const confirmedReservations = reservations.filter((r) => r.status === 'confirmed')
  const totalParticipants = confirmedReservations.reduce(
    (sum, r) => sum + r.participant_count,
    0
  )
  const remaining = event.capacity - confirmedParticipants

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/admin/events">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">予約一覧</h1>
      </div>
      <EventTabs />

      {/* Event Summary */}
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{event.title}</h2>
            <p className="mt-1 text-sm text-gray-600">
              {formatDate(event.event_date)} {formatTime(event.start_time)}〜{formatTime(event.end_time)}
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="text-center">
              <p className="text-gray-500">定員</p>
              <p className="text-lg font-bold text-gray-900">{event.capacity}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-500">確定参加者</p>
              <p className="text-lg font-bold text-blue-600">{totalParticipants}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-500">残り</p>
              <p className="text-lg font-bold text-green-600">{remaining}</p>
            </div>
          </div>
        </div>
      </Card>


      {/* Waitlist Notification */}
      {waitlistNotification && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-yellow-800">{waitlistNotification}</p>
            <div className="flex items-center gap-3">
              <Link to={`/admin/events/${eventId}/waitlist`}>
                <Button size="sm" className="bg-yellow-500 hover:bg-yellow-600 text-white">
                  繰り上げ確認
                </Button>
              </Link>
              <button
                onClick={() => setWaitlistNotification(null)}
                className="text-yellow-600 hover:text-yellow-800"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="flex flex-wrap gap-4 text-sm text-gray-600">
        <span>
          予約件数: <span className="font-semibold text-gray-900">{reservations.length}</span>
        </span>
        <span>
          承認待ち: <span className="font-semibold text-yellow-600">{reservations.filter(r => r.status === 'pending_approval').length}</span>
        </span>
        <span>
          確定予約: <span className="font-semibold text-gray-900">{confirmedReservations.length}</span>
        </span>
        <span>
          確定参加者数: <span className="font-semibold text-gray-900">{totalParticipants}</span>
        </span>
      </div>

      {/* Search / Filter / Export Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="氏名・メール・電話番号で検索"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">すべて</option>
            <option value="pending_approval">承認待ち</option>
            <option value="confirmed">予約確定</option>
            <option value="rejected">却下</option>
            <option value="cancelled">キャンセル</option>
            <option value="attended">参加済</option>
            <option value="no_show">無断欠席</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            {filteredReservations.length}件表示中 / 全{reservations.length}件
          </span>
          <Button variant="secondary" size="sm" onClick={handleExportCSV}>
            <Download className="mr-1 h-3.5 w-3.5" />
            CSV出力
          </Button>
        </div>
      </div>

      {reservations.length === 0 ? (
        <EmptyState
          icon={Users}
          title="予約がありません"
          description="まだこのイベントへの予約はありません"
        />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm lg:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">氏名</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">メールアドレス</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">電話番号</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">参加人数</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">予約時間帯</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">ステータス</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">注意事項承諾</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">予約日時</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">操作</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">詳細</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredReservations.map((reservation) => (
                  <tr key={reservation.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {reservation.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {reservation.email}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {reservation.phone}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-700">
                      {reservation.participant_count}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {getSlotLabel(reservation, event)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={STATUS_BADGE_VARIANT[reservation.status] ?? 'default'}>
                        {RESERVATION_STATUS_LABELS[reservation.status] ?? reservation.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {reservation.agreed_to_caution ? (
                        <CheckCircle2 className="mx-auto h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="mx-auto h-5 w-5 text-gray-300" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {formatDateTime(reservation.created_at)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {reservation.status === 'pending_approval' ? (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleStatusChange(reservation.id, 'confirmed')}
                            className="rounded-md bg-green-600 px-3 py-1 text-sm font-medium text-white hover:bg-green-700"
                          >
                            承認
                          </button>
                          <button
                            onClick={() => handleStatusChange(reservation.id, 'rejected')}
                            className="rounded-md bg-red-600 px-3 py-1 text-sm font-medium text-white hover:bg-red-700"
                          >
                            却下
                          </button>
                        </div>
                      ) : (
                        <select
                          value={reservation.status}
                          onChange={(e) =>
                            handleStatusChange(reservation.id, e.target.value)
                          }
                          className="rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {RESERVATION_STATUS_LABELS[status]}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => openDetail(reservation)}
                        className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-600 hover:bg-gray-100"
                      >
                        <Eye className="inline h-3.5 w-3.5 mr-1" />
                        詳細
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="space-y-4 lg:hidden">
            {filteredReservations.map((reservation) => (
              <Card key={reservation.id}>
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{reservation.name}</p>
                      <p className="text-sm text-gray-500">{reservation.email}</p>
                    </div>
                    <Badge variant={STATUS_BADGE_VARIANT[reservation.status] ?? 'default'}>
                      {RESERVATION_STATUS_LABELS[reservation.status] ?? reservation.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-400">電話: </span>
                      <span className="text-gray-700">{reservation.phone}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">人数: </span>
                      <span className="text-gray-700">{reservation.participant_count}名</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-400">時間帯: </span>
                      <span className="text-gray-700">{getSlotLabel(reservation, event)}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">承諾: </span>
                      {reservation.agreed_to_caution ? (
                        <span className="text-green-600">承諾済</span>
                      ) : (
                        <span className="text-gray-400">未承諾</span>
                      )}
                    </div>
                    <div>
                      <span className="text-gray-400">予約日: </span>
                      <span className="text-gray-700">{formatDateTime(reservation.created_at)}</span>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-3 space-y-2">
                    {reservation.status === 'pending_approval' ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleStatusChange(reservation.id, 'confirmed')}
                          className="flex-1 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
                        >
                          承認
                        </button>
                        <button
                          onClick={() => handleStatusChange(reservation.id, 'rejected')}
                          className="flex-1 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
                        >
                          却下
                        </button>
                      </div>
                    ) : (
                      <>
                        <label className="mb-1 block text-xs text-gray-500">ステータス変更</label>
                        <select
                          value={reservation.status}
                          onChange={(e) =>
                            handleStatusChange(reservation.id, e.target.value)
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {RESERVATION_STATUS_LABELS[status]}
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                    <button
                      onClick={() => openDetail(reservation)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
                    >
                      <Eye className="inline h-3.5 w-3.5 mr-1" />
                      詳細を見る
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Detail Modal */}
      <Modal
        isOpen={detail !== null}
        onClose={() => setDetail(null)}
        title={detail ? `${detail.reservation.name} さんの詳細` : '予約詳細'}
        size="xl"
      >
        {detail && (
          <div className="space-y-5">
            {/* Customer Profile Header */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                    <User className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{detail.reservation.name}</p>
                    <p className="text-sm text-gray-500">{detail.reservation.email}</p>
                  </div>
                </div>
                {detail.customer && (
                  <Link
                    to={`/admin/customers/${detail.customer.id}`}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-500"
                    onClick={() => setDetail(null)}
                  >
                    カルテを開く
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div>
                  <span className="text-xs text-gray-500">電話番号</span>
                  <p className="text-gray-900">{detail.reservation.phone}</p>
                </div>
                {detail.customer?.prefecture && (
                  <div>
                    <span className="text-xs text-gray-500">都道府県</span>
                    <p className="text-gray-900">{detail.customer.prefecture}</p>
                  </div>
                )}
                {detail.customer?.age_group && (
                  <div>
                    <span className="text-xs text-gray-500">年代</span>
                    <p className="text-gray-900">{detail.customer.age_group}</p>
                  </div>
                )}
                <div>
                  <span className="text-xs text-gray-500">通算参加</span>
                  <p className="font-bold text-blue-600">
                    {detailLoading ? '...' : `${detail.participationCount + detail.activities.length}回`}
                  </p>
                </div>
              </div>
            </div>

            {/* This Reservation */}
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-900">今回の予約</h3>
              <div className="rounded-lg border border-gray-200 p-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-xs text-gray-500">時間帯</span>
                    <p className="text-gray-900">{getSlotLabel(detail.reservation, event)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">参加人数</span>
                    <p className="text-gray-900">{detail.reservation.participant_count}名</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">ステータス</span>
                    <p>
                      <Badge variant={STATUS_BADGE_VARIANT[detail.reservation.status] ?? 'default'}>
                        {RESERVATION_STATUS_LABELS[detail.reservation.status] ?? detail.reservation.status}
                      </Badge>
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">予約日時</span>
                    <p className="text-gray-900">{formatDateTime(detail.reservation.created_at)}</p>
                  </div>
                </div>
                {detail.reservation.note && (
                  <div className="mt-2 border-t border-gray-100 pt-2 text-sm">
                    <span className="text-xs text-gray-500">備考</span>
                    <p className="text-gray-900">{detail.reservation.note}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Caution + Survey in 2 columns on desktop */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Caution Agreement */}
              <div>
                <div className="mb-2 flex items-center gap-1.5">
                  <ClipboardCheck className="h-4 w-4 text-gray-600" />
                  <h3 className="text-sm font-semibold text-gray-900">注意事項</h3>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                  {detail.reservation.agreed_to_caution ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="font-medium text-green-700">承諾済み</span>
                      </div>
                      {detail.reservation.agreed_at && (
                        <p className="text-xs text-gray-500">
                          {formatDateTime(detail.reservation.agreed_at)}
                        </p>
                      )}
                      {detail.reservation.caution_version && (
                        <p className="text-xs text-gray-500">v{detail.reservation.caution_version}</p>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <XCircle className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-500">未承諾</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Survey Answers */}
              <div>
                <div className="mb-2 flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-gray-600" />
                  <h3 className="text-sm font-semibold text-gray-900">アンケート</h3>
                </div>
                {detailLoading ? (
                  <div className="flex justify-center rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <LoadingSpinner size="sm" />
                  </div>
                ) : detail.surveyAnswers.length === 0 ? (
                  <p className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">
                    回答なし
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {detail.surveyAnswers.map((a) => (
                      <div key={a.id} className="rounded-lg border border-gray-200 bg-gray-50 p-2 text-sm">
                        <p className="text-xs font-medium text-gray-500">
                          {a.survey_questions?.question_text ?? '(質問不明)'}
                        </p>
                        <p className="text-gray-900">
                          {a.answer_text
                            ? a.answer_text
                            : Array.isArray(a.answer_json)
                              ? (a.answer_json as string[]).join(', ')
                              : '-'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Admin Memo */}
            {detail.customer?.memo && (
              <div>
                <div className="mb-2 flex items-center gap-1.5">
                  <StickyNote className="h-4 w-4 text-gray-600" />
                  <h3 className="text-sm font-semibold text-gray-900">管理者メモ</h3>
                </div>
                <p className="whitespace-pre-wrap rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-gray-800">
                  {detail.customer.memo}
                </p>
              </div>
            )}

            {/* Activity History */}
            {!detailLoading && detail.activities.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-1.5">
                  <BookOpen className="h-4 w-4 text-gray-600" />
                  <h3 className="text-sm font-semibold text-gray-900">
                    活動履歴
                    <span className="ml-1 font-normal text-gray-400">（直近5件）</span>
                  </h3>
                </div>
                <div className="space-y-1.5">
                  {detail.activities.slice(0, 5).map((act) => (
                    <div key={act.id} className="rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">{formatDate(act.activity_date)}</span>
                        <span className="font-medium text-gray-900">{act.title}</span>
                      </div>
                      {act.plan && (
                        <p className="mt-0.5 text-xs text-gray-600">プラン: {act.plan}</p>
                      )}
                      {act.memo && (
                        <p className="mt-0.5 text-xs text-gray-500">{act.memo}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Past Reservations */}
            {!detailLoading && detail.pastReservations.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-gray-600" />
                  <h3 className="text-sm font-semibold text-gray-900">
                    過去の予約
                    <span className="ml-1 font-normal text-gray-400">（直近5件）</span>
                  </h3>
                </div>
                <div className="space-y-1.5">
                  {detail.pastReservations.slice(0, 5).map((pr) => (
                    <div key={pr.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900">
                          {pr.events?.title ?? '(不明)'}
                        </p>
                        <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                          {pr.events && (
                            <>
                              <span>{formatDate(pr.events.event_date)}</span>
                              <span>{pr.events.location}</span>
                            </>
                          )}
                          <span>{pr.participant_count}名</span>
                        </div>
                      </div>
                      <Badge
                        variant={
                          pr.status === 'confirmed' ? 'success'
                            : pr.status === 'attended' ? 'info'
                            : pr.status === 'cancelled' ? 'default'
                            : pr.status === 'no_show' ? 'danger'
                            : 'default'
                        }
                      >
                        {RESERVATION_STATUS_LABELS[pr.status] ?? pr.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No customer found hint */}
            {!detailLoading && !detail.customer && (
              <p className="text-center text-xs text-gray-400">
                この予約者は顧客登録がありません（ゲスト予約）
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
