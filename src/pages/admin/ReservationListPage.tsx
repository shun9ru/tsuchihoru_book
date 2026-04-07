import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import EventTabs from '@/components/admin/EventTabs'
import {
  ArrowLeft,
  Users,
  FileText,
  ClipboardList,
  Mail,
  CheckCircle2,
  XCircle,
  Download,
  Search,
} from 'lucide-react'
import { eventsApi, reservationsApi, waitlistsApi } from '@/lib/api'
import { Button, Card, Badge, LoadingSpinner, EmptyState } from '@/components/ui'
import { formatDate, formatTime, formatDateTime } from '@/lib/utils'
import { RESERVATION_STATUS_LABELS } from '@/lib/constants'
import { downloadCSV } from '@/lib/csv'
import type { Event, Reservation, ReservationStatus } from '@/types'

const STATUS_BADGE_VARIANT: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'default'> = {
  confirmed: 'success',
  cancelled: 'danger',
  attended: 'info',
  no_show: 'warning',
}

const STATUS_OPTIONS: ReservationStatus[] = ['confirmed', 'cancelled', 'attended', 'no_show']

export default function ReservationListPage() {
  const { id: eventId } = useParams<{ id: string }>()
  const [event, setEvent] = useState<Event | null>(null)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmedParticipants, setConfirmedParticipants] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [waitlistCount, setWaitlistCount] = useState(0)
  const [waitlistNotification, setWaitlistNotification] = useState<string | null>(null)

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
    const headers = ['氏名', 'メールアドレス', '電話番号', '参加人数', 'ステータス', '備考', '予約日時']
    const rows = filteredReservations.map(r => [
      r.name,
      r.email,
      r.phone,
      String(r.participant_count),
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
        prev.map((r) => (r.id === reservationId ? updated : r))
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

      {/* Quick Links */}
      <div className="flex flex-wrap gap-2">
        <Link to={`/admin/events/${eventId}/edit`}>
          <Button variant="secondary" size="sm">
            <FileText className="mr-1 h-3.5 w-3.5" />
            イベント編集
          </Button>
        </Link>
        <Link to={`/admin/events/${eventId}/caution`}>
          <Button variant="secondary" size="sm">
            <ClipboardList className="mr-1 h-3.5 w-3.5" />
            注意事項
          </Button>
        </Link>
        <Link to={`/admin/events/${eventId}/surveys`}>
          <Button variant="secondary" size="sm">
            <ClipboardList className="mr-1 h-3.5 w-3.5" />
            アンケート
          </Button>
        </Link>
        <Link to={`/admin/events/${eventId}/emails`}>
          <Button variant="secondary" size="sm">
            <Mail className="mr-1 h-3.5 w-3.5" />
            一斉メール
          </Button>
        </Link>
        <Link to={`/admin/events/${eventId}/waitlist`}>
          <Button variant="secondary" size="sm">
            <Users className="mr-1 h-3.5 w-3.5" />
            キャンセル待ち管理{waitlistCount > 0 && ` (${waitlistCount}件)`}
          </Button>
        </Link>
      </div>

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
      <div className="flex gap-4 text-sm text-gray-600">
        <span>
          予約件数: <span className="font-semibold text-gray-900">{reservations.length}</span>
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
            <option value="confirmed">予約確定</option>
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
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">ステータス</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">注意事項承諾</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">予約日時</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">操作</th>
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

                  <div className="border-t border-gray-100 pt-3">
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
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
