import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Calendar, Plus, Pencil, Trash2, ArrowLeft, Clock } from 'lucide-react'
import { eventsApi, eventDatesApi } from '@/lib/api'
import {
  Button,
  Card,
  Input,
  Select,
  Checkbox,
  Badge,
  Modal,
  ConfirmDialog,
  LoadingSpinner,
  EmptyState,
} from '@/components/ui'
import { formatDate } from '@/lib/utils'
import type { Event, EventDate } from '@/types'

/** 15分刻みの時間選択肢を生成 */
const TIME_OPTIONS = Array.from({ length: 24 * 4 }, (_, i) => {
  const h = String(Math.floor(i / 4)).padStart(2, '0')
  const m = String((i % 4) * 15).padStart(2, '0')
  return { value: `${h}:${m}`, label: `${h}:${m}` }
})

interface DateFormState {
  event_date: string
  start_time: string
  end_time: string
  capacity: number
  is_available: boolean
}

const defaultDateForm: DateFormState = {
  event_date: '',
  start_time: '10:00',
  end_time: '17:00',
  capacity: 20,
  is_available: true,
}

export default function EventDatesPage() {
  const { id: eventId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [event, setEvent] = useState<Event | null>(null)
  const [dates, setDates] = useState<EventDate[]>([])
  const [reservationCounts, setReservationCounts] = useState<Record<string, number>>({})

  // Toggle state
  const [useMultiDates, setUseMultiDates] = useState(false)
  const [savingToggle, setSavingToggle] = useState(false)

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingDateId, setEditingDateId] = useState<string | null>(null)
  const [dateForm, setDateForm] = useState<DateFormState>(defaultDateForm)
  const [savingDate, setSavingDate] = useState(false)

  // Delete state
  const [deleteDateId, setDeleteDateId] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!eventId) return
    try {
      const [eventData, datesData, counts] = await Promise.all([
        eventsApi.getEvent(eventId),
        eventDatesApi.getEventDates(eventId),
        eventDatesApi.getDateReservationCounts(eventId),
      ])
      setEvent(eventData)
      setDates(datesData)
      setReservationCounts(counts)
      setUseMultiDates(eventData.use_multi_dates)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'データの読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSaveToggle = async () => {
    if (!eventId) return
    setSavingToggle(true)
    setError(null)
    try {
      const updated = await eventsApi.updateEvent(eventId, {
        use_multi_dates: useMultiDates,
      })
      setEvent(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : '設定の保存に失敗しました')
    } finally {
      setSavingToggle(false)
    }
  }

  const handleOpenAddModal = () => {
    setEditingDateId(null)
    setDateForm(defaultDateForm)
    setModalOpen(true)
  }

  const handleOpenEditModal = (date: EventDate) => {
    setEditingDateId(date.id)
    setDateForm({
      event_date: date.event_date,
      start_time: date.start_time.slice(0, 5),
      end_time: date.end_time ? date.end_time.slice(0, 5) : '',
      capacity: date.capacity,
      is_available: date.is_available,
    })
    setModalOpen(true)
  }

  /** Auto-populate events.event_date to the earliest date */
  const syncEarliestDate = async (updatedDates: EventDate[]) => {
    if (!eventId || updatedDates.length === 0) return
    const sorted = [...updatedDates].sort((a, b) => a.event_date.localeCompare(b.event_date))
    const earliest = sorted[0].event_date
    if (event && event.event_date !== earliest) {
      try {
        const updated = await eventsApi.updateEvent(eventId, { event_date: earliest })
        setEvent(updated)
      } catch {
        // non-critical, silently ignore
      }
    }
  }

  const handleSaveDate = async () => {
    if (!eventId) return
    setSavingDate(true)
    setError(null)
    try {
      if (editingDateId) {
        // Update
        const updated = await eventDatesApi.updateEventDate(editingDateId, {
          event_date: dateForm.event_date,
          start_time: dateForm.start_time,
          end_time: dateForm.end_time,
          capacity: dateForm.capacity,
          is_available: dateForm.is_available,
        })
        const newDates = dates.map((d) => (d.id === editingDateId ? updated : d))
        setDates(newDates)
        await syncEarliestDate(newDates)
      } else {
        // Create
        const created = await eventDatesApi.createEventDate({
          event_id: eventId,
          event_date: dateForm.event_date,
          start_time: dateForm.start_time,
          end_time: dateForm.end_time,
          capacity: dateForm.capacity,
          is_available: dateForm.is_available,
          sort_order: dates.length,
        })
        const newDates = [...dates, created]
        setDates(newDates)
        await syncEarliestDate(newDates)
      }
      setModalOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '開催日の保存に失敗しました')
    } finally {
      setSavingDate(false)
    }
  }

  const handleDeleteDate = async () => {
    if (!deleteDateId) return
    setError(null)
    try {
      await eventDatesApi.deleteEventDate(deleteDateId)
      const newDates = dates.filter((d) => d.id !== deleteDateId)
      setDates(newDates)
      if (newDates.length > 0) {
        await syncEarliestDate(newDates)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '開催日の削除に失敗しました')
    } finally {
      setDeleteDateId(null)
    }
  }

  const handleToggleAvailable = async (date: EventDate) => {
    setError(null)
    try {
      const updated = await eventDatesApi.updateEventDate(date.id, {
        is_available: !date.is_available,
      })
      setDates((prev) => prev.map((d) => (d.id === date.id ? updated : d)))
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新に失敗しました')
    }
  }

  const formatTime = (time: string) => time.slice(0, 5)

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/admin/events/${eventId}/edit`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Calendar className="h-6 w-6 text-gray-600" />
        <h1 className="text-2xl font-bold text-gray-900">開催日管理</h1>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Toggle Card */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">複数日開催設定</h2>
        <div className="space-y-4">
          <Checkbox
            label="複数日開催にする"
            checked={useMultiDates}
            onChange={(e) => setUseMultiDates(e.target.checked)}
          />

          {!useMultiDates ? (
            <p className="text-sm text-gray-500">
              このイベントは単一日開催です。イベント編集画面で開催日を設定してください。
            </p>
          ) : (
            <p className="text-sm text-gray-500">
              複数日にわたるイベントの開催日を個別に管理できます。
            </p>
          )}
        </div>

        <div className="mt-6 border-t pt-4">
          <Button onClick={handleSaveToggle} loading={savingToggle}>
            設定を保存
          </Button>
        </div>
      </Card>

      {/* Date List (only when multi-dates is ON) */}
      {useMultiDates && (
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              開催日一覧 ({dates.length}件)
            </h2>
            <Button variant="secondary" size="sm" onClick={handleOpenAddModal}>
              <Plus className="mr-1 h-4 w-4" />
              開催日を追加
            </Button>
          </div>

          {dates.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="開催日がありません"
              description="「開催日を追加」ボタンから開催日を追加してください。"
            />
          ) : (
            <div className="space-y-3">
              {dates.map((date) => {
                const reserved = reservationCounts[date.id] || 0
                const remaining = date.capacity - reserved
                return (
                  <Card key={date.id}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">
                            {formatDate(date.event_date)}
                          </span>
                          <Badge variant={date.is_available ? 'success' : 'default'}>
                            {date.is_available ? '有効' : '無効'}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            時間: {formatTime(date.start_time)} 〜 {date.end_time ? formatTime(date.end_time) : '未定'}
                          </span>
                          <span>定員: {date.capacity}</span>
                          <span>
                            予約数: {reserved} / {date.capacity}
                            <span className="ml-1">
                              (残り
                              <Badge
                                variant={remaining > 0 ? 'success' : 'danger'}
                              >
                                {remaining}
                              </Badge>
                              )
                            </span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 text-sm">
                          <input
                            type="checkbox"
                            checked={date.is_available}
                            onChange={() => handleToggleAvailable(date)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          有効
                        </label>

                        {event?.use_time_slots && (
                          <Link to={`/admin/events/${eventId}/time-slots`}>
                            <Button variant="ghost" size="sm">
                              <Clock className="h-4 w-4" />
                            </Button>
                          </Link>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditModal(date)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteDateId(date.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </Card>
      )}

      {/* Add/Edit Date Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingDateId ? '開催日を編集' : '開催日を追加'}
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label="開催日"
            type="date"
            value={dateForm.event_date}
            onChange={(e) => setDateForm((prev) => ({ ...prev, event_date: e.target.value }))}
            required
          />
          <Select
            label="開始時間"
            options={TIME_OPTIONS}
            value={dateForm.start_time}
            onChange={(e) => setDateForm((prev) => ({ ...prev, start_time: e.target.value }))}
          />
          <Select
            label="終了時間"
            options={TIME_OPTIONS}
            value={dateForm.end_time}
            onChange={(e) => setDateForm((prev) => ({ ...prev, end_time: e.target.value }))}
          />
          <Input
            label="定員"
            type="number"
            min={1}
            value={dateForm.capacity}
            onChange={(e) => setDateForm((prev) => ({ ...prev, capacity: Number(e.target.value) }))}
          />
          <Checkbox
            label="有効にする"
            checked={dateForm.is_available}
            onChange={(e) => setDateForm((prev) => ({ ...prev, is_available: e.target.checked }))}
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleSaveDate} loading={savingDate}>
              {editingDateId ? '更新する' : '追加する'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteDateId}
        onClose={() => setDeleteDateId(null)}
        onConfirm={handleDeleteDate}
        title="開催日の削除"
        message="この開催日を削除しますか？関連する予約がある場合は注意してください。"
        confirmLabel="削除する"
        variant="danger"
      />
    </div>
  )
}
