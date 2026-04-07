import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Clock, Plus, Trash2, RefreshCw } from 'lucide-react'
import { eventsApi, timeSlotsApi, eventDatesApi } from '@/lib/api'
import {
  Button,
  Card,
  Input,
  Select,
  Checkbox,
  Badge,
  LoadingSpinner,
  ConfirmDialog,
  Modal,
} from '@/components/ui'
import { SLOT_INTERVAL_OPTIONS } from '@/lib/constants'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import type { Event, EventTimeSlot, EventDate } from '@/types'

export default function TimeSlotSettingsPage() {
  const { id: eventId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [event, setEvent] = useState<Event | null>(null)
  const [slots, setSlots] = useState<EventTimeSlot[]>([])
  const [reservationCounts, setReservationCounts] = useState<Record<string, number>>({})

  // Multi-date state
  const [eventDates, setEventDates] = useState<EventDate[]>([])
  const [selectedDateId, setSelectedDateId] = useState<string | null>(null)

  // Settings state
  const [useTimeSlots, setUseTimeSlots] = useState(false)
  const [slotInterval, setSlotInterval] = useState('30')
  const [slotCapacity, setSlotCapacity] = useState(10)

  // UI state
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmGenerate, setConfirmGenerate] = useState(false)
  const [deleteSlotId, setDeleteSlotId] = useState<string | null>(null)
  const [addModalOpen, setAddModalOpen] = useState(false)

  // Add slot form state
  const [newStartTime, setNewStartTime] = useState('10:00')
  const [newEndTime, setNewEndTime] = useState('10:30')
  const [newCapacity, setNewCapacity] = useState(10)

  /** Load slots for current context (global or per-date) */
  const loadSlots = useCallback(async (eid: string, dateId: string | null) => {
    if (dateId) {
      const [slotsData, counts] = await Promise.all([
        eventDatesApi.getTimeSlotsForDate(dateId),
        timeSlotsApi.getSlotReservationCounts(eid, dateId),
      ])
      setSlots(slotsData)
      setReservationCounts(counts)
    } else {
      const [slotsData, counts] = await Promise.all([
        timeSlotsApi.getTimeSlots(eid),
        timeSlotsApi.getSlotReservationCounts(eid),
      ])
      setSlots(slotsData)
      setReservationCounts(counts)
    }
  }, [])

  const loadData = useCallback(async () => {
    if (!eventId) return
    try {
      const eventData = await eventsApi.getEvent(eventId)
      setEvent(eventData)
      setUseTimeSlots(eventData.use_time_slots)
      setSlotInterval(String(eventData.slot_interval_minutes))
      setSlotCapacity(eventData.slot_capacity)

      // If multi-dates, fetch event dates
      if (eventData.use_multi_dates) {
        const datesData = await eventDatesApi.getEventDates(eventId)
        setEventDates(datesData)
        const firstDateId = datesData.length > 0 ? datesData[0].id : null
        setSelectedDateId(firstDateId)
        await loadSlots(eventId, firstDateId)
      } else {
        await loadSlots(eventId, null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'データの読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [eventId, loadSlots])

  useEffect(() => {
    loadData()
  }, [loadData])

  /** When selected date changes, reload slots */
  const handleSelectDate = async (dateId: string) => {
    if (!eventId) return
    setSelectedDateId(dateId)
    setError(null)
    try {
      await loadSlots(eventId, dateId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'スロットの読み込みに失敗しました')
    }
  }

  const handleSaveSettings = async () => {
    if (!eventId) return
    setSaving(true)
    setError(null)
    try {
      await eventsApi.updateEvent(eventId, {
        use_time_slots: useTimeSlots,
        slot_interval_minutes: Number(slotInterval),
        slot_capacity: slotCapacity,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '設定の保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  /** Get the start/end time for slot generation based on context */
  const getGenerateTimeRange = (): { startTime: string; endTime: string } | null => {
    if (event?.use_multi_dates && selectedDateId) {
      const selectedDate = eventDates.find((d) => d.id === selectedDateId)
      if (selectedDate) {
        return {
          startTime: selectedDate.start_time.slice(0, 5),
          endTime: selectedDate.end_time ? selectedDate.end_time.slice(0, 5) : '',
        }
      }
    }
    if (event) {
      return {
        startTime: event.start_time.slice(0, 5),
        endTime: event.end_time.slice(0, 5),
      }
    }
    return null
  }

  const handleGenerateSlots = async () => {
    if (!eventId || !event) return
    setConfirmGenerate(false)
    setGenerating(true)
    setError(null)
    try {
      const range = getGenerateTimeRange()
      if (!range) throw new Error('時間範囲が取得できません')

      const generated = await timeSlotsApi.generateTimeSlots(
        eventId,
        range.startTime,
        range.endTime,
        Number(slotInterval),
        slotCapacity,
        event.use_multi_dates && selectedDateId ? selectedDateId : undefined
      )
      setSlots(generated)
      setReservationCounts({})
      await syncCapacity(generated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'スロットの生成に失敗しました')
    } finally {
      setGenerating(false)
    }
  }

  const handleGenerateClick = () => {
    if (slots.length > 0) {
      setConfirmGenerate(true)
    } else {
      handleGenerateSlots()
    }
  }

  const handleUpdateSlot = async (slotId: string, updates: { capacity?: number; is_available?: boolean }) => {
    setError(null)
    try {
      const updated = await timeSlotsApi.updateTimeSlot(slotId, updates)
      const newSlots = slots.map((s) => (s.id === slotId ? updated : s))
      setSlots(newSlots)
      await syncCapacity(newSlots)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'スロットの更新に失敗しました')
    }
  }

  const handleDeleteSlot = async () => {
    if (!deleteSlotId) return
    setError(null)
    try {
      await timeSlotsApi.deleteTimeSlot(deleteSlotId)
      const newSlots = slots.filter((s) => s.id !== deleteSlotId)
      setSlots(newSlots)
      await syncCapacity(newSlots)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'スロットの削除に失敗しました')
    } finally {
      setDeleteSlotId(null)
    }
  }

  const handleAddSlot = async () => {
    if (!eventId) return
    setError(null)
    try {
      const insertData = {
        event_id: eventId,
        start_time: newStartTime,
        end_time: newEndTime,
        capacity: newCapacity,
        is_available: true,
        sort_order: slots.length,
        event_date_id: event?.use_multi_dates && selectedDateId ? selectedDateId : null,
      }
      const { data, error: insertError } = await supabase
        .from('event_time_slots')
        .insert(insertData)
        .select()
        .single()
      if (insertError) throw new Error(insertError.message)
      const newSlots = [...slots, data]
      setSlots(newSlots)
      setAddModalOpen(false)
      await syncCapacity(newSlots)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'スロットの追加に失敗しました')
    }
  }

  /** スロット合計定員をイベント/開催日に反映 */
  const syncCapacity = async (currentSlots: EventTimeSlot[]) => {
    const totalCapacity = currentSlots
      .filter(s => s.is_available)
      .reduce((sum, s) => sum + s.capacity, 0)

    try {
      if (event?.use_multi_dates && selectedDateId) {
        await eventDatesApi.updateEventDate(selectedDateId, { capacity: totalCapacity })
      }
      // イベント全体の定員も更新（全スロット合計 or 複数日の場合は全日付の合計）
      if (!event?.use_multi_dates) {
        await eventsApi.updateEvent(eventId!, { capacity: totalCapacity })
      }
    } catch {
      // 定員同期のエラーは致命的ではないので無視
    }
  }

  const formatTime = (time: string) => time.slice(0, 5)

  /** Get the time range description for the generate hint */
  const getTimeRangeDescription = (): string => {
    const range = getGenerateTimeRange()
    if (!range) return ''
    return `${range.startTime} 〜 ${range.endTime}`
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
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/admin/events/${eventId}/edit`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Clock className="h-6 w-6 text-gray-600" />
        <h1 className="text-2xl font-bold text-gray-900">時間割設定</h1>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Date Tabs (multi-date mode) */}
      {event?.use_multi_dates && eventDates.length > 0 && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-gray-700">開催日を選択</h2>
          <div className="flex flex-wrap gap-2">
            {eventDates.map((d) => (
              <button
                key={d.id}
                onClick={() => handleSelectDate(d.id)}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                  selectedDateId === d.id
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {formatDate(d.event_date)}
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Settings Card */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">時間割設定</h2>
        <div className="space-y-4">
          <Checkbox
            label="時間割予約を使用する"
            checked={useTimeSlots}
            onChange={(e) => setUseTimeSlots(e.target.checked)}
          />

          {!useTimeSlots ? (
            <p className="text-sm text-gray-500">
              このイベントは通常の定員管理を使用しています
            </p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Select
                  label="スロット間隔"
                  options={SLOT_INTERVAL_OPTIONS}
                  value={slotInterval}
                  onChange={(e) => setSlotInterval(e.target.value)}
                />
                <Input
                  label="スロットごとの定員"
                  type="number"
                  min={1}
                  value={slotCapacity}
                  onChange={(e) => setSlotCapacity(Number(e.target.value))}
                />
              </div>
              <Button
                variant="secondary"
                onClick={handleGenerateClick}
                loading={generating}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                スロットを一括生成
              </Button>
              {getTimeRangeDescription() && (
                <p className="text-xs text-gray-400">
                  {event?.use_multi_dates && selectedDateId
                    ? `選択中の開催日の時間: ${getTimeRangeDescription()} の範囲でスロットを生成します`
                    : `イベント時間: ${getTimeRangeDescription()} の範囲でスロットを生成します`}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 border-t pt-4">
          <Button onClick={handleSaveSettings} loading={saving}>
            設定を保存
          </Button>
        </div>
      </Card>

      {/* Slots List */}
      {useTimeSlots && (
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              スロット一覧 ({slots.length}件)
            </h2>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setNewCapacity(slotCapacity)
                setAddModalOpen(true)
              }}
            >
              <Plus className="mr-1 h-4 w-4" />
              スロットを追加
            </Button>
          </div>

          {slots.length > 0 && (
            <div className="mb-4 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">
              合計定員: <span className="font-bold">{slots.filter(s => s.is_available).reduce((sum, s) => sum + s.capacity, 0)}名</span>
              <span className="ml-2 text-blue-600">（有効なスロットの定員合計がイベントの定員に自動反映されます）</span>
            </div>
          )}

          {slots.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">
              スロットがありません。上の「スロットを一括生成」ボタンで生成してください。
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-2 font-medium">時間帯</th>
                    <th className="pb-2 font-medium">定員</th>
                    <th className="pb-2 font-medium">予約数</th>
                    <th className="pb-2 font-medium">残席</th>
                    <th className="pb-2 font-medium">有効</th>
                    <th className="pb-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {slots.map((slot) => {
                    const reserved = reservationCounts[slot.id] || 0
                    const remaining = slot.capacity - reserved
                    return (
                      <tr key={slot.id} className="hover:bg-gray-50">
                        <td className="py-3 pr-4 font-medium">
                          {formatTime(slot.start_time)} 〜 {formatTime(slot.end_time)}
                        </td>
                        <td className="py-3 pr-4">
                          <input
                            type="number"
                            min={1}
                            className="w-20 rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={slot.capacity}
                            onChange={(e) => {
                              const val = Number(e.target.value)
                              if (val > 0) {
                                handleUpdateSlot(slot.id, { capacity: val })
                              }
                            }}
                          />
                        </td>
                        <td className="py-3 pr-4">
                          {reserved} / {slot.capacity}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge
                            variant={remaining > 0 ? 'success' : 'danger'}
                          >
                            {remaining}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4">
                          <input
                            type="checkbox"
                            checked={slot.is_available}
                            onChange={(e) =>
                              handleUpdateSlot(slot.id, {
                                is_available: e.target.checked,
                              })
                            }
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="py-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteSlotId(slot.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Generate Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmGenerate}
        onClose={() => setConfirmGenerate(false)}
        onConfirm={handleGenerateSlots}
        title="スロットの再生成"
        message="既存のスロットを削除して再生成しますか？"
        confirmLabel="再生成する"
        variant="danger"
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteSlotId}
        onClose={() => setDeleteSlotId(null)}
        onConfirm={handleDeleteSlot}
        title="スロットの削除"
        message="このスロットを削除しますか？関連する予約がある場合は注意してください。"
        confirmLabel="削除する"
        variant="danger"
      />

      {/* Add Slot Modal */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="スロットを追加"
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label="開始時間"
            type="time"
            value={newStartTime}
            onChange={(e) => setNewStartTime(e.target.value)}
          />
          <Input
            label="終了時間"
            type="time"
            value={newEndTime}
            onChange={(e) => setNewEndTime(e.target.value)}
          />
          <Input
            label="定員"
            type="number"
            min={1}
            value={newCapacity}
            onChange={(e) => setNewCapacity(Number(e.target.value))}
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setAddModalOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleAddSlot}>
              追加する
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
