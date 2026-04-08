import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Users,
  ArrowUpCircle,
  XCircle,
} from 'lucide-react'
import { eventsApi, waitlistsApi } from '@/lib/api'
import { Button, Card, Badge, LoadingSpinner, EmptyState, ConfirmDialog } from '@/components/ui'
import { formatDate, formatTime, formatDateTime } from '@/lib/utils'
import { WAITLIST_STATUS_LABELS } from '@/lib/constants'
import type { Event, Waitlist, WaitlistStatus } from '@/types'

const STATUS_BADGE_VARIANT: Record<WaitlistStatus, 'warning' | 'success' | 'danger'> = {
  waiting: 'warning',
  promoted: 'success',
  cancelled: 'danger',
}

export default function WaitlistManagePage() {
  const { id: eventId } = useParams<{ id: string }>()
  const [event, setEvent] = useState<Event | null>(null)
  const [entries, setEntries] = useState<Waitlist[]>([])
  const [confirmedParticipants, setConfirmedParticipants] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Confirm dialog state
  const [promoteTarget, setPromoteTarget] = useState<Waitlist | null>(null)
  const [cancelTarget, setCancelTarget] = useState<Waitlist | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (eventId) {
      loadData(eventId)
    }
  }, [eventId])

  async function loadData(id: string) {
    try {
      setLoading(true)
      const [eventData, waitlistData, participantCount] = await Promise.all([
        eventsApi.getEvent(id),
        waitlistsApi.getWaitlist(id),
        eventsApi.getConfirmedParticipantCount(id),
      ])
      setEvent(eventData)
      setEntries(waitlistData)
      setConfirmedParticipants(participantCount)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'データの読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  async function handlePromote() {
    if (!promoteTarget || !event || !eventId) return

    const remaining = event.capacity - confirmedParticipants
    if (remaining < promoteTarget.participant_count) {
      setActionError(
        remaining <= 0
          ? '空きがないため繰り上げできません。'
          : `空きは${remaining}名分ですが、この方の参加人数は${promoteTarget.participant_count}名です。`
      )
      setPromoteTarget(null)
      return
    }

    try {
      setActionError(null)
      await waitlistsApi.promoteWaitlistEntry(
        promoteTarget.id,
        eventId,
        event.caution_version ?? 1
      )
      setPromoteTarget(null)
      await loadData(eventId)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '繰り上げに失敗しました')
      setPromoteTarget(null)
    }
  }

  async function handleCancel() {
    if (!cancelTarget || !eventId) return

    try {
      setActionError(null)
      await waitlistsApi.cancelWaitlistEntry(cancelTarget.id)
      setCancelTarget(null)
      await loadData(eventId)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'キャンセルに失敗しました')
      setCancelTarget(null)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error || !event) {
    return (
      <EmptyState
        icon={Users}
        title="イベントが見つかりません"
      />
    )
  }

  const remaining = event.capacity - confirmedParticipants

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={`/admin/events/${eventId}/reservations`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">キャンセル待ち管理</h1>
      </div>

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
              <p className="text-lg font-bold text-blue-600">{confirmedParticipants}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-500">残り</p>
              <p className="text-lg font-bold text-green-600">{remaining}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-500">待ち人数</p>
              <p className="text-lg font-bold text-yellow-600">{entries.length}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Action Error */}
      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">{actionError}</p>
        </div>
      )}

      {entries.length === 0 ? (
        <EmptyState
          icon={Users}
          title="キャンセル待ちはありません"
          description="現在キャンセル待ちの登録はありません"
        />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm lg:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">#</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">氏名</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">メールアドレス</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">電話番号</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">参加人数</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">ステータス</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">登録日時</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((entry, index) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-center text-sm font-medium text-gray-500">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {entry.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {entry.email}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {entry.phone}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-700">
                      {entry.participant_count}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={STATUS_BADGE_VARIANT[entry.status as WaitlistStatus] ?? 'default'}>
                        {WAITLIST_STATUS_LABELS[entry.status] ?? entry.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {formatDateTime(entry.created_at)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {entry.status === 'waiting' && (
                          <>
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => setPromoteTarget(entry)}
                            >
                              <ArrowUpCircle className="mr-1 h-3.5 w-3.5" />
                              繰り上げ
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => setCancelTarget(entry)}
                            >
                              <XCircle className="mr-1 h-3.5 w-3.5" />
                              キャンセル
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="space-y-4 lg:hidden">
            {entries.map((entry, index) => (
              <Card key={entry.id}>
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-gray-400">#{index + 1}</p>
                      <p className="font-medium text-gray-900">{entry.name}</p>
                      <p className="text-sm text-gray-500">{entry.email}</p>
                    </div>
                    <Badge variant={STATUS_BADGE_VARIANT[entry.status as WaitlistStatus] ?? 'default'}>
                      {WAITLIST_STATUS_LABELS[entry.status] ?? entry.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-400">電話: </span>
                      <span className="text-gray-700">{entry.phone}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">人数: </span>
                      <span className="text-gray-700">{entry.participant_count}名</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-400">登録日: </span>
                      <span className="text-gray-700">{formatDateTime(entry.created_at)}</span>
                    </div>
                  </div>

                  {entry.status === 'waiting' && (
                    <div className="flex gap-2 border-t border-gray-100 pt-3">
                      <Button
                        size="sm"
                        variant="primary"
                        className="flex-1"
                        onClick={() => setPromoteTarget(entry)}
                      >
                        <ArrowUpCircle className="mr-1 h-3.5 w-3.5" />
                        繰り上げ
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        className="flex-1"
                        onClick={() => setCancelTarget(entry)}
                      >
                        <XCircle className="mr-1 h-3.5 w-3.5" />
                        キャンセル
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Promote Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!promoteTarget}
        onClose={() => setPromoteTarget(null)}
        onConfirm={handlePromote}
        title="繰り上げ確認"
        message={`${promoteTarget?.name}さんを繰り上げて予約確定にしますか？`}
        confirmLabel="繰り上げる"
      />

      {/* Cancel Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancel}
        title="キャンセル確認"
        message="キャンセル待ちを取り消しますか？"
        confirmLabel="取り消す"
        variant="danger"
      />
    </div>
  )
}
