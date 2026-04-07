import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  CalendarDays,
  Copy,
  Loader2,
} from 'lucide-react'
import { eventsApi, reservationsApi, surveysApi, remindersApi } from '@/lib/api'
import {
  Button,
  Card,
  Badge,
  LoadingSpinner,
  EmptyState,
  ConfirmDialog,
} from '@/components/ui'
import { formatDate } from '@/lib/utils'
import type { Event } from '@/types'

interface EventWithCount {
  event: Event
  reservationCount: number
}

export default function AdminEventListPage() {
  const [events, setEvents] = useState<EventWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<Event | null>(null)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    loadEvents()
  }, [])

  // Auto-dismiss success message
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  async function loadEvents() {
    try {
      const allEvents = await eventsApi.getAllEvents()
      const withCounts = await Promise.all(
        allEvents.map(async (event) => {
          const reservations = await reservationsApi.getReservations(event.id)
          const confirmedCount = reservations.filter((r) => r.status === 'confirmed').length
          return { event, reservationCount: confirmedCount }
        })
      )
      setEvents(withCounts)
    } catch (err) {
      console.error('イベント一覧の取得に失敗しました:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await eventsApi.deleteEvent(deleteTarget.id)
      setEvents((prev) => prev.filter((e) => e.event.id !== deleteTarget.id))
    } catch (err) {
      console.error('イベントの削除に失敗しました:', err)
    } finally {
      setDeleteTarget(null)
    }
  }

  async function duplicateEvent(id: string) {
    if (duplicatingId) return
    setDuplicatingId(id)

    try {
      // 1. Fetch full event data
      const original = await eventsApi.getEvent(id)

      // 2. Create new event with copied data
      const newEvent = await eventsApi.createEvent({
        title: original.title + '（コピー）',
        description: original.description,
        event_date: original.event_date,
        start_time: original.start_time,
        end_time: original.end_time,
        location: original.location,
        capacity: original.capacity,
        fee: original.fee,
        target_audience: original.target_audience,
        belongings: original.belongings,
        caution_text: original.caution_text,
        caution_version: original.caution_version,
        reservation_start_at: original.reservation_start_at,
        reservation_end_at: original.reservation_end_at,
        is_published: false,
        is_accepting: false,
      })

      // 3. Duplicate survey questions
      const questions = await surveysApi.getSurveyQuestions(id)
      for (const q of questions) {
        await surveysApi.createSurveyQuestion({
          event_id: newEvent.id,
          question_text: q.question_text,
          question_type: q.question_type,
          is_required: q.is_required,
          sort_order: q.sort_order,
          options_json: q.options_json,
        })
      }

      // 4. Duplicate reminder jobs with status reset
      const reminderJobs = await remindersApi.getReminderJobs(id)
      for (const job of reminderJobs) {
        await remindersApi.upsertReminderJob({
          event_id: newEvent.id,
          remind_type: job.remind_type,
          subject: job.subject,
          body: job.body,
          is_enabled: job.is_enabled,
          scheduled_at: remindersApi.calculateScheduledAt(
            newEvent.event_date,
            job.remind_type
          ),
        })
      }

      setSuccessMessage(`「${original.title}」を複製しました`)
      navigate(`/admin/events/${newEvent.id}/edit`)
    } catch (err) {
      console.error('イベントの複製に失敗しました:', err)
      alert('イベントの複製に失敗しました。もう一度お試しください。')
    } finally {
      setDuplicatingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Success Toast */}
      {successMessage && (
        <div className="fixed right-4 top-20 z-50 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800 shadow-lg">
          {successMessage}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">イベント管理</h1>
        <Link to="/admin/events/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            新規イベント作成
          </Button>
        </Link>
      </div>

      {events.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="イベントがありません"
          description="新しいイベントを作成しましょう"
          action={
            <Link to="/admin/events/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                新規イベント作成
              </Button>
            </Link>
          }
        />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">タイトル</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">開催日</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">定員</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">予約数</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">公開状態</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">受付状態</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {events.map(({ event, reservationCount }) => (
                  <tr key={event.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        to={`/admin/events/${event.id}/edit`}
                        className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {event.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {formatDate(event.event_date)}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-700">
                      {event.capacity}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-700">
                      {reservationCount}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={event.is_published ? 'success' : 'default'}>
                        {event.is_published ? '公開中' : '非公開'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={event.is_accepting ? 'success' : 'default'}>
                        {event.is_accepting ? '受付中' : '受付停止'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link to={`/admin/events/${event.id}/edit`}>
                          <Button variant="ghost" size="sm">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Link to={`/admin/events/${event.id}/reservations`}>
                          <Button variant="ghost" size="sm">
                            <Users className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => duplicateEvent(event.id)}
                          disabled={duplicatingId === event.id}
                          title="複製"
                        >
                          {duplicatingId === event.id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                          ) : (
                            <Copy className="h-4 w-4 text-blue-500" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(event)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="space-y-4 md:hidden">
            {events.map(({ event, reservationCount }) => (
              <Card key={event.id}>
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <Link
                      to={`/admin/events/${event.id}/edit`}
                      className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {event.title}
                    </Link>
                    <div className="ml-2 flex gap-1">
                      <Badge variant={event.is_published ? 'success' : 'default'}>
                        {event.is_published ? '公開' : '非公開'}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                    <div>
                      <span className="text-gray-400">開催日: </span>
                      {formatDate(event.event_date)}
                    </div>
                    <div>
                      <span className="text-gray-400">定員: </span>
                      {event.capacity}名
                    </div>
                    <div>
                      <span className="text-gray-400">予約: </span>
                      {reservationCount}件
                    </div>
                    <div>
                      <Badge variant={event.is_accepting ? 'success' : 'default'}>
                        {event.is_accepting ? '受付中' : '受付停止'}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex gap-2 border-t border-gray-100 pt-3">
                    <Link to={`/admin/events/${event.id}/edit`} className="flex-1">
                      <Button variant="secondary" size="sm" className="w-full">
                        <Pencil className="mr-1 h-3.5 w-3.5" />
                        編集
                      </Button>
                    </Link>
                    <Link to={`/admin/events/${event.id}/reservations`} className="flex-1">
                      <Button variant="secondary" size="sm" className="w-full">
                        <Users className="mr-1 h-3.5 w-3.5" />
                        予約一覧
                      </Button>
                    </Link>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => duplicateEvent(event.id)}
                      disabled={duplicatingId === event.id}
                      title="複製"
                    >
                      {duplicatingId === event.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setDeleteTarget(event)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="イベントの削除"
        message={`「${deleteTarget?.title}」を削除してもよろしいですか？この操作は取り消せません。関連する予約データも全て削除されます。`}
        confirmLabel="削除する"
        variant="danger"
      />
    </div>
  )
}
