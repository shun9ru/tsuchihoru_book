import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { eventsApi, eventDatesApi, timeSlotsApi } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { Button, Card, Input, Select, LoadingSpinner, Badge } from '@/components/ui'
import { Textarea } from '@/components/ui/Textarea'
import { Checkbox } from '@/components/ui/Checkbox'
import { eventSchema, type EventFormValues } from '@/lib/validations'
import { formatDate } from '@/lib/utils'
import SaveStatus from '@/components/ui/SaveStatus'
import { useAutoSave } from '@/lib/useAutoSave'
import { SLOT_INTERVAL_OPTIONS } from '@/lib/constants'
import type { EventDate } from '@/types'

/** 15分刻みの時間選択肢 */
const TIME_OPTIONS = Array.from({ length: 24 * 4 }, (_, i) => {
  const h = String(Math.floor(i / 4)).padStart(2, '0')
  const m = String((i % 4) * 15).padStart(2, '0')
  return { value: `${h}:${m}`, label: `${h}:${m}` }
})

/** 1時間刻みの時間選択肢 */
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const h = String(i).padStart(2, '0')
  return { value: `${h}:00`, label: `${h}:00` }
})

interface SlotEntry {
  id?: string
  start_time: string
  end_time: string
  capacity: number
  is_available: boolean
  reserved?: number
}

interface DateFormEntry {
  id?: string
  event_date: string
  start_time: string
  end_time: string
  capacity: number
  slots: SlotEntry[]
}

/** 時間範囲と間隔からスロットを生成 */
function buildSlots(startTime: string, endTime: string, intervalMinutes: number, capacityPerSlot: number): SlotEntry[] {
  if (!startTime || !endTime) return []
  const [sH, sM] = startTime.split(':').map(Number)
  const [eH, eM] = endTime.split(':').map(Number)
  let cur = sH * 60 + sM
  const end = eH * 60 + eM
  const result: SlotEntry[] = []

  while (cur + intervalMinutes <= end) {
    const sh = String(Math.floor(cur / 60)).padStart(2, '0')
    const sm = String(cur % 60).padStart(2, '0')
    const next = cur + intervalMinutes
    const eh = String(Math.floor(next / 60)).padStart(2, '0')
    const em = String(next % 60).padStart(2, '0')
    result.push({
      start_time: `${sh}:${sm}`,
      end_time: `${eh}:${em}`,
      capacity: capacityPerSlot,
      is_available: true,
    })
    cur = next
  }
  return result
}

export default function EventFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEditing = !!id

  const [loading, setLoading] = useState(isEditing)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const initialLoadDone = useRef(!isEditing) // 新規作成時はtrue、編集時はloadEvent完了後にtrue

  // 時間割
  const [useTimeSlots, setUseTimeSlots] = useState(false)
  const [slotInterval, setSlotInterval] = useState('30')
  const [slotCapacity, setSlotCapacity] = useState(1)
  const [allowMultiSlot, setAllowMultiSlot] = useState(false)

  // 日程（常にリストで管理）
  const [dateEntries, setDateEntries] = useState<DateFormEntry[]>([
    { event_date: '', start_time: '10:00', end_time: '12:00', capacity: 10, slots: [] },
  ])
  const [existingDates, setExistingDates] = useState<EventDate[]>([])

  // 受付期間
  const [resStartDate, setResStartDate] = useState('')
  const [resStartTime, setResStartTime] = useState('00:00')
  const [resEndDate, setResEndDate] = useState('')
  const [resEndTime, setResEndTime] = useState('23:00')

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      event_date: '',
      start_time: '',
      end_time: '',
      fee: 0,
      is_published: false,
      is_accepting: false,
    },
  })

  useEffect(() => {
    if (id) loadEvent(id)
  }, [id])

  // --- スロット自動生成: 間隔 or 枠定員が変わったら全日程を再生成 ---
  const regenerateAllSlots = useCallback((entries: DateFormEntry[], interval: string, cap: number) => {
    const intervalMin = Number(interval)
    return entries.map(entry => ({
      ...entry,
      slots: buildSlots(entry.start_time, entry.end_time, intervalMin, cap),
    }))
  }, [])

  useEffect(() => {
    if (!initialLoadDone.current) return // ロード中はスキップ
    if (!useTimeSlots) return
    setDateEntries(prev => regenerateAllSlots(prev, slotInterval, slotCapacity))
  }, [slotInterval, slotCapacity, useTimeSlots, regenerateAllSlots])

  // --- 定員の自動計算 ---
  const totalCapacity = dateEntries.reduce((sum, entry) => {
    if (useTimeSlots) {
      return sum + entry.slots.filter(s => s.is_available).reduce((ss, s) => ss + s.capacity, 0)
    }
    return sum + entry.capacity
  }, 0)

  useEffect(() => {
    setValue('capacity', totalCapacity)
  }, [totalCapacity, setValue])

  // dateEntries の変更を react-hook-form に同期
  useEffect(() => {
    const first = [...dateEntries].sort((a, b) => a.event_date.localeCompare(b.event_date))[0]
    if (first) {
      setValue('event_date', first.event_date, { shouldValidate: true })
      setValue('start_time', first.start_time, { shouldValidate: true })
      setValue('end_time', first.end_time || '', { shouldValidate: true })
    }
  }, [dateEntries, setValue])

  async function loadEvent(eventId: string) {
    try {
      const [event, dates] = await Promise.all([
        eventsApi.getEvent(eventId),
        eventDatesApi.getEventDates(eventId),
      ])
      reset({
        title: event.title,
        description: event.description ?? '',
        event_date: event.event_date,
        start_time: event.start_time.slice(0, 5),
        end_time: event.end_time.slice(0, 5),
        location: event.location,
        capacity: event.capacity,
        fee: event.fee,
        target_audience: event.target_audience ?? '',
        belongings: event.belongings ?? '',
        reservation_start_at: event.reservation_start_at ?? '',
        reservation_end_at: event.reservation_end_at ?? '',
        is_published: event.is_published,
        is_accepting: event.is_accepting,
      })

      setUseTimeSlots(event.use_time_slots)
      setSlotInterval(String(event.slot_interval_minutes))
      setSlotCapacity(event.slot_capacity)
      setAllowMultiSlot(event.allow_multi_slot_reservation)
      setExistingDates(dates)

      if (dates.length > 0) {
        // 複数日（or 1日でも日程レコードあり）
        const entries: DateFormEntry[] = await Promise.all(
          dates.map(async (d) => {
            let dateSlots: SlotEntry[] = []
            if (event.use_time_slots) {
              const [slotsData, counts] = await Promise.all([
                eventDatesApi.getTimeSlotsForDate(d.id),
                timeSlotsApi.getSlotReservationCounts(eventId, d.id),
              ])
              dateSlots = slotsData.map(s => ({
                id: s.id,
                start_time: s.start_time.slice(0, 5),
                end_time: s.end_time.slice(0, 5),
                capacity: s.capacity,
                is_available: s.is_available,
                reserved: counts[s.id] || 0,
              }))
            }
            return {
              id: d.id,
              event_date: d.event_date,
              start_time: d.start_time.slice(0, 5),
              end_time: d.end_time ? d.end_time.slice(0, 5) : '',
              capacity: d.capacity,
              slots: dateSlots,
            }
          })
        )
        setDateEntries(entries)
      } else {
        // 旧データ: 日程レコードなし → イベント本体から1件作成
        let eventSlots: SlotEntry[] = []
        if (event.use_time_slots) {
          const [slotsData, counts] = await Promise.all([
            timeSlotsApi.getTimeSlots(eventId),
            timeSlotsApi.getSlotReservationCounts(eventId),
          ])
          eventSlots = slotsData.map(s => ({
            id: s.id,
            start_time: s.start_time.slice(0, 5),
            end_time: s.end_time.slice(0, 5),
            capacity: s.capacity,
            is_available: s.is_available,
            reserved: counts[s.id] || 0,
          }))
        }
        setDateEntries([{
          event_date: event.event_date,
          start_time: event.start_time.slice(0, 5),
          end_time: event.end_time.slice(0, 5),
          capacity: event.capacity,
          slots: eventSlots,
        }])
      }

      if (event.reservation_start_at) {
        const d = new Date(event.reservation_start_at)
        setResStartDate(d.toISOString().slice(0, 10))
        setResStartTime(`${String(d.getHours()).padStart(2, '0')}:00`)
      }
      if (event.reservation_end_at) {
        const d = new Date(event.reservation_end_at)
        setResEndDate(d.toISOString().slice(0, 10))
        setResEndTime(`${String(d.getHours()).padStart(2, '0')}:00`)
      }
    } catch (err) {
      console.error('イベントの読み込みに失敗しました:', err)
    } finally {
      initialLoadDone.current = true
      setLoading(false)
    }
  }

  // --- 日程操作 ---
  function addDateEntry() {
    setDateEntries(prev => {
      const last = prev[prev.length - 1]
      const newEntry: DateFormEntry = {
        event_date: '',
        start_time: last?.start_time || '10:00',
        end_time: last?.end_time || '12:00',
        capacity: last?.capacity || 10,
        slots: [],
      }
      if (useTimeSlots) {
        newEntry.slots = buildSlots(newEntry.start_time, newEntry.end_time, Number(slotInterval), slotCapacity)
      }
      return [...prev, newEntry]
    })
  }

  function removeDateEntry(index: number) {
    setDateEntries(prev => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev)
  }

  function updateDateEntry(index: number, field: 'event_date' | 'start_time' | 'end_time' | 'capacity', value: string | number) {
    setDateEntries(prev => prev.map((entry, i) => {
      if (i !== index) return entry
      const updated = { ...entry, [field]: value }
      // 時間割ON時、時間が変わったらスロット再生成
      if (useTimeSlots && (field === 'start_time' || field === 'end_time')) {
        updated.slots = buildSlots(
          field === 'start_time' ? String(value) : updated.start_time,
          field === 'end_time' ? String(value) : updated.end_time,
          Number(slotInterval),
          slotCapacity,
        )
      }
      return updated
    }))
  }

  // --- 個別スロット編集 ---
  function updateDateSlot(dateIndex: number, slotIndex: number, field: keyof SlotEntry, value: string | number | boolean) {
    setDateEntries(prev => prev.map((e, i) =>
      i === dateIndex
        ? { ...e, slots: e.slots.map((s, si) => si === slotIndex ? { ...s, [field]: value } : s) }
        : e
    ))
  }

  function removeDateSlot(dateIndex: number, slotIndex: number) {
    setDateEntries(prev => prev.map((e, i) =>
      i === dateIndex ? { ...e, slots: e.slots.filter((_, si) => si !== slotIndex) } : e
    ))
  }

  // --- 保存（共通ロジック） ---
  async function saveEvent(data: EventFormValues): Promise<string> {
    const sorted = [...dateEntries].sort((a, b) => a.event_date.localeCompare(b.event_date))
    const first = sorted[0]
    const isMulti = dateEntries.length > 1

    const payload = {
      title: data.title,
      description: data.description || null,
      event_date: first?.event_date || data.event_date,
      start_time: first?.start_time || data.start_time,
      end_time: first?.end_time || data.end_time,
      location: data.location,
      capacity: totalCapacity,
      fee: data.fee,
      target_audience: data.target_audience || null,
      belongings: data.belongings || null,
      reservation_start_at: resStartDate ? `${resStartDate}T${resStartTime}` : null,
      reservation_end_at: resEndDate ? `${resEndDate}T${resEndTime}` : null,
      is_published: data.is_published,
      is_accepting: data.is_accepting,
      use_multi_dates: isMulti,
      use_time_slots: useTimeSlots,
      slot_interval_minutes: Number(slotInterval),
      slot_capacity: slotCapacity,
      allow_multi_slot_reservation: allowMultiSlot,
    }

    let eventId: string
    if (isEditing && id) {
      await eventsApi.updateEvent(id, payload)
      eventId = id
    } else {
      const created = await eventsApi.createEvent(payload)
      eventId = created.id
    }

    const savedDateIds = await syncEventDates(eventId)
    if (useTimeSlots) await syncAllTimeSlots(eventId, savedDateIds)
    return eventId
  }

  // 自動保存（編集モードのみ）
  const formValues = watch()
  const autoSaveStatus = useAutoSave(
    async () => {
      if (!id) return
      const data = getValues()
      // 最低限の入力チェック（タイトルと会場が空なら保存しない）
      if (!data.title?.trim() || !data.location?.trim()) return
      if (dateEntries.some(d => !d.event_date || !d.start_time)) return
      await saveEvent(data)
    },
    [
      formValues.title, formValues.description, formValues.location,
      formValues.fee, formValues.target_audience, formValues.belongings,
      formValues.is_published, formValues.is_accepting,
      useTimeSlots, slotInterval, slotCapacity, allowMultiSlot,
      resStartDate, resStartTime, resEndDate, resEndTime,
      JSON.stringify(dateEntries),
    ],
    2000,
    isEditing && !loading,
  )

  // 手動保存（ボタン押下 / 新規作成時）
  const onSubmit = async (data: EventFormValues) => {
    setSubmitError(null)

    if (dateEntries.some(d => !d.event_date || !d.start_time)) {
      setSubmitError('すべての日程に日付と開始時間を入力してください。')
      return
    }

    if (useTimeSlots && dateEntries.some(d => d.slots.length === 0)) {
      setSubmitError('時間割を使用する場合、すべての日程にスロットが必要です。開始・終了時間と間隔を確認してください。')
      return
    }

    try {
      const eventId = await saveEvent(data)

      if (isEditing) {
        navigate('/admin/events')
      } else {
        navigate(`/admin/events/${eventId}/edit`, { replace: true })
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'イベントの保存に失敗しました')
    }
  }

  async function syncEventDates(eventId: string): Promise<string[]> {
    const existingIds = new Set(existingDates.map(d => d.id))
    const currentIds = new Set(dateEntries.filter(d => d.id).map(d => d.id!))

    for (const existing of existingDates) {
      if (!currentIds.has(existing.id)) {
        await eventDatesApi.deleteEventDate(existing.id)
      }
    }

    const savedDateIds: string[] = []
    for (let i = 0; i < dateEntries.length; i++) {
      const entry = dateEntries[i]
      const cap = useTimeSlots
        ? entry.slots.filter(s => s.is_available).reduce((sum, s) => sum + s.capacity, 0)
        : entry.capacity
      const dateData = {
        event_id: eventId,
        event_date: entry.event_date,
        start_time: entry.start_time,
        end_time: entry.end_time || null,
        capacity: cap,
        is_available: true,
        sort_order: i,
      }
      if (entry.id && existingIds.has(entry.id)) {
        await eventDatesApi.updateEventDate(entry.id, dateData)
        savedDateIds.push(entry.id)
      } else {
        const created = await eventDatesApi.createEventDate(dateData)
        savedDateIds.push(created.id)
      }
    }
    return savedDateIds
  }

  async function syncAllTimeSlots(eventId: string, savedDateIds: string[]) {
    await supabase.from('event_time_slots').delete().eq('event_id', eventId)

    const inserts: Array<{
      event_id: string
      event_date_id: string
      start_time: string
      end_time: string
      capacity: number
      is_available: boolean
      sort_order: number
    }> = []

    for (let di = 0; di < dateEntries.length; di++) {
      const dateId = savedDateIds[di]
      for (let si = 0; si < dateEntries[di].slots.length; si++) {
        const s = dateEntries[di].slots[si]
        inserts.push({
          event_id: eventId,
          event_date_id: dateId,
          start_time: s.start_time,
          end_time: s.end_time,
          capacity: s.capacity,
          is_available: s.is_available,
          sort_order: si,
        })
      }
    }

    if (inserts.length > 0) {
      const { error } = await supabase.from('event_time_slots').insert(inserts)
      if (error) throw new Error(`時間割の保存に失敗しました: ${error.message}`)
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
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/events')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold text-gray-900">
          {isEditing ? 'イベント編集' : '新規イベント作成'}
        </h1>
        {isEditing && <SaveStatus status={autoSaveStatus} />}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">基本情報</h2>
          <div className="space-y-4">
            <Input
              label="タイトル"
              placeholder="イベントのタイトル"
              error={errors.title?.message}
              required
              {...register('title')}
            />

            <Textarea
              label="説明"
              placeholder="イベントの説明・詳細"
              error={errors.description?.message}
              rows={5}
              {...register('description')}
            />

            <Input
              label="会場"
              placeholder="開催場所"
              error={errors.location?.message}
              required
              {...register('location')}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Input
                  label="定員（全体）"
                  type="number"
                  placeholder="20"
                  error={errors.capacity?.message}
                  required
                  disabled={useTimeSlots}
                  {...register('capacity', { valueAsNumber: true })}
                />
                {useTimeSlots && (
                  <p className="mt-1 text-xs text-blue-600">
                    時間割の合計から自動計算: {totalCapacity}名
                  </p>
                )}
              </div>
              <Input
                label="参加費（円）"
                type="number"
                placeholder="0"
                error={errors.fee?.message}
                {...register('fee', { valueAsNumber: true })}
              />
            </div>

            {/* 時間割トグル */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <Checkbox
                label="時間割で予約枠を管理する"
                checked={useTimeSlots}
                onChange={(e) => setUseTimeSlots(e.target.checked)}
              />
              {useTimeSlots && (
                <div className="ml-6 mt-2 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs text-gray-500">間隔</label>
                      <Select
                        options={SLOT_INTERVAL_OPTIONS}
                        value={slotInterval}
                        onChange={(e) => setSlotInterval(e.target.value)}
                        className="w-24"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs text-gray-500">枠定員</label>
                      <Input
                        type="number"
                        min={1}
                        value={slotCapacity}
                        onChange={(e) => setSlotCapacity(Number(e.target.value))}
                        className="w-20"
                      />
                      <span className="text-xs text-gray-400">名</span>
                    </div>
                  </div>
                  <Checkbox
                    label="予約時に複数の日時を選択可能にする"
                    checked={allowMultiSlot}
                    onChange={(e) => setAllowMultiSlot(e.target.checked)}
                  />
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* 開催日程 */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">開催日程</h2>
            <Button type="button" variant="secondary" size="sm" onClick={addDateEntry}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              日程を追加
            </Button>
          </div>

          <div className="space-y-3">
            {dateEntries.map((entry, di) => {
              const dateSlotTotal = entry.slots.filter(s => s.is_available).reduce((sum, s) => sum + s.capacity, 0)
              const dateSlotReserved = entry.slots.filter(s => s.is_available).reduce((sum, s) => sum + (s.reserved ?? 0), 0)

              return (
                <div key={di} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <Badge variant="info">
                      {entry.event_date ? formatDate(entry.event_date) : `日程 ${di + 1}`}
                    </Badge>
                    {dateEntries.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeDateEntry(di)}
                        className="rounded p-1 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Input label="開催日" type="date" required value={entry.event_date}
                      onChange={(e) => updateDateEntry(di, 'event_date', e.target.value)} />
                    <Select label="開始時間" options={TIME_OPTIONS} required value={entry.start_time}
                      onChange={(e) => updateDateEntry(di, 'start_time', e.target.value)} />
                    <Select label="終了時間" options={TIME_OPTIONS} value={entry.end_time}
                      onChange={(e) => updateDateEntry(di, 'end_time', e.target.value)} />
                    {!useTimeSlots && (
                      <Input label="定員" type="number" required min={1} value={entry.capacity}
                        onChange={(e) => updateDateEntry(di, 'capacity', Number(e.target.value))} />
                    )}
                    {useTimeSlots && entry.slots.length > 0 && (
                      <div className="flex flex-col justify-end">
                        <span className="text-xs text-gray-500">定員（自動）</span>
                        <span className="text-sm font-medium text-gray-900">
                          {dateSlotTotal}名
                          {isEditing && dateSlotReserved > 0 && (
                            <span className="ml-1 text-xs text-blue-600">({dateSlotReserved}予約)</span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 時間割スロット一覧 */}
                  {useTimeSlots && entry.slots.length > 0 && (
                    <div className="mt-3 max-h-48 divide-y divide-gray-200 overflow-y-auto rounded border border-gray-200 bg-white">
                      {entry.slots.map((slot, si) => {
                        const reserved = slot.reserved ?? 0
                        const remaining = slot.capacity - reserved
                        return (
                          <div key={si} className="flex items-center gap-1.5 px-2 py-1 text-xs">
                            <input
                              type="checkbox"
                              checked={slot.is_available}
                              onChange={(e) => updateDateSlot(di, si, 'is_available', e.target.checked)}
                              className="h-3 w-3 rounded border-gray-300"
                              title="有効/無効"
                            />
                            <span className="font-mono text-gray-700">{slot.start_time}〜{slot.end_time}</span>
                            <input
                              type="number"
                              min={1}
                              className="w-12 rounded border border-gray-300 px-1 py-0.5 text-center text-xs focus:border-blue-500 focus:outline-none"
                              value={slot.capacity}
                              onChange={(e) => updateDateSlot(di, si, 'capacity', Number(e.target.value))}
                            />
                            <span className="text-gray-400">名</span>
                            {isEditing && reserved > 0 && (
                              <span className={`${remaining > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {reserved}予約/残{remaining}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => removeDateSlot(di, si)}
                              className="ml-auto rounded p-0.5 text-gray-300 hover:text-red-500"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {useTimeSlots && entry.slots.length === 0 && entry.start_time && entry.end_time && (
                    <p className="mt-2 text-xs text-amber-600">
                      開始・終了時間と間隔の組み合わせではスロットを生成できません
                    </p>
                  )}
                </div>
              )
            })}
          </div>

          {/* event_date / start_time / end_time は useEffect で setValue 同期済み */}
        </Card>

        {/* Additional Info */}
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">追加情報</h2>
          <div className="space-y-4">
            <Input
              label="対象者"
              placeholder="例: 小学生以上"
              error={errors.target_audience?.message}
              {...register('target_audience')}
            />
            <Textarea
              label="持ち物"
              placeholder="例: 動きやすい服装、飲み物"
              error={errors.belongings?.message}
              rows={3}
              {...register('belongings')}
            />
          </div>
        </Card>

        {/* Reservation Period */}
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">予約受付期間</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="受付開始日" type="date" value={resStartDate}
                onChange={(e) => setResStartDate(e.target.value)} />
              <Select label="受付開始時間" options={HOUR_OPTIONS} placeholder="選択してください"
                value={resStartTime} onChange={(e) => setResStartTime(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="受付終了日" type="date" value={resEndDate}
                onChange={(e) => setResEndDate(e.target.value)} />
              <Select label="受付終了時間" options={HOUR_OPTIONS} placeholder="選択してください"
                value={resEndTime} onChange={(e) => setResEndTime(e.target.value)} />
            </div>
          </div>
          <p className="mt-2 text-sm text-gray-500">
            未設定の場合、期間制限なしで予約を受け付けます。
          </p>
        </Card>

        {/* Publishing */}
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">公開設定</h2>
          <div className="space-y-3">
            <Checkbox label="イベントを公開する" {...register('is_published')} />
            <Checkbox label="予約受付を開始する" {...register('is_accepting')} />
          </div>
        </Card>

        {/* Error */}
        {submitError && (
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{submitError}</div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {isEditing ? (
            <Button type="button" variant="secondary" onClick={() => navigate('/admin/events')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              一覧に戻る
            </Button>
          ) : (
            <>
              <Button type="submit" loading={isSubmitting}>
                作成する
              </Button>
              <Button type="button" variant="secondary" onClick={() => navigate('/admin/events')}>
                キャンセル
              </Button>
            </>
          )}
        </div>
      </form>
    </div>
  )
}
