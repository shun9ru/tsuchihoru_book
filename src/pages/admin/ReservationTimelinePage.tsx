import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import EventTabs from '@/components/admin/EventTabs'
import {
  ArrowLeft, ChevronLeft, ChevronRight, Clock, Users, FileText,
  User, ExternalLink, ClipboardCheck, CheckCircle2, XCircle,
  StickyNote, BookOpen, Calendar, MapPin, Ticket, Hash,
} from 'lucide-react'
import { eventsApi, reservationsApi, eventDatesApi, timeSlotsApi, customersApi, customerActivitiesApi } from '@/lib/api'
import { Button, Card, Badge, LoadingSpinner, EmptyState } from '@/components/ui'
import { Modal } from '@/components/ui/Modal'
import { formatDate, formatDateTime, getSlotLabel } from '@/lib/utils'
import { RESERVATION_STATUS_LABELS } from '@/lib/constants'
import type { Event, EventDate, EventTimeSlot, Customer, CustomerActivity } from '@/types'
import type { ReservationWithSlot } from '@/lib/api/reservations'

interface SurveyAnswerDetail {
  id: string
  answer_text: string | null
  answer_json: unknown
  survey_questions: {
    question_text: string
    question_type: string
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

interface DetailData {
  surveyAnswers: SurveyAnswerDetail[]
  participationCount: number
  customer: Customer | null
  activities: CustomerActivity[]
  pastReservations: PastReservation[]
}

const STATUS_DOT_COLOR: Record<string, string> = {
  pending_approval: 'bg-yellow-400',
  confirmed: 'bg-green-400',
  rejected: 'bg-red-400',
  cancelled: 'bg-red-300',
  attended: 'bg-blue-400',
  no_show: 'bg-orange-400',
}

const STATUS_BG_COLOR: Record<string, string> = {
  pending_approval: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  confirmed: 'bg-green-50 border-green-200 text-green-800',
  rejected: 'bg-red-50 border-red-200 text-red-800',
  cancelled: 'bg-red-50 border-red-200 text-red-700',
  attended: 'bg-blue-50 border-blue-200 text-blue-800',
  no_show: 'bg-orange-50 border-orange-200 text-orange-800',
}

function toMinutes(t: string): number {
  const [h, m] = t.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

function fromMinutes(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

function getSlotTime(r: ReservationWithSlot, event: Event): { start: number; end: number } {
  if (r.event_time_slots) {
    return { start: toMinutes(r.event_time_slots.start_time), end: toMinutes(r.event_time_slots.end_time) }
  }
  if (r.event_dates) {
    return {
      start: toMinutes(r.event_dates.start_time),
      end: r.event_dates.end_time ? toMinutes(r.event_dates.end_time) : toMinutes(r.event_dates.start_time) + 60,
    }
  }
  return { start: toMinutes(event.start_time), end: toMinutes(event.end_time) }
}

/** 確定系ステータスかどうか（定員カウント対象） */
function isActiveReservation(status: string): boolean {
  return status === 'pending_approval' || status === 'confirmed' || status === 'attended'
}

interface SlotCapacity {
  start: number
  end: number
  capacity: number
  slotId: string
}

export default function ReservationTimelinePage() {
  const { id: eventId } = useParams<{ id: string }>()
  const [event, setEvent] = useState<Event | null>(null)
  const [eventDates, setEventDates] = useState<EventDate[]>([])
  const [timeSlotData, setTimeSlotData] = useState<EventTimeSlot[]>([])
  const [reservations, setReservations] = useState<ReservationWithSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDateIndex, setSelectedDateIndex] = useState(0)
  const [selectedReservation, setSelectedReservation] = useState<ReservationWithSlot | null>(null)
  const [detailData, setDetailData] = useState<DetailData | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  async function openDetail(reservation: ReservationWithSlot) {
    setSelectedReservation(reservation)
    setDetailLoading(true)
    setDetailData(null)
    try {
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

      setDetailData({ surveyAnswers: answers, participationCount: count, customer, activities, pastReservations })
    } catch (err) {
      console.error('詳細情報の取得に失敗しました:', err)
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => {
    if (eventId) loadData(eventId)
  }, [eventId])

  async function loadData(id: string) {
    try {
      const [eventData, reservationData, dates, slots] = await Promise.all([
        eventsApi.getEvent(id),
        reservationsApi.getReservations(id),
        eventDatesApi.getEventDates(id),
        timeSlotsApi.getTimeSlots(id),
      ])
      setEvent(eventData)
      setReservations(reservationData)
      setEventDates(dates.sort((a, b) => a.event_date.localeCompare(b.event_date)))
      setTimeSlotData(slots)
    } catch (err) {
      console.error('データの読み込みに失敗しました:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleStatusChange(reservationId: string, newStatus: string) {
    try {
      const updated = await reservationsApi.updateReservationStatus(reservationId, newStatus)
      setReservations(prev => prev.map(r => r.id === reservationId ? { ...r, status: updated.status } : r))
      setSelectedReservation(prev => prev?.id === reservationId ? { ...prev, status: updated.status } : prev)
    } catch (err) {
      console.error('ステータス更新に失敗:', err)
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
    return <EmptyState icon={Clock} title="イベントが見つかりません" />
  }

  // 日程リスト
  const dateList = eventDates.length > 0
    ? eventDates.map(d => ({ id: d.id, date: d.event_date, start: d.start_time, end: d.end_time || d.start_time, capacity: d.capacity }))
    : [{ id: null as string | null, date: event.event_date, start: event.start_time, end: event.end_time, capacity: event.capacity }]

  const currentDate = dateList[selectedDateIndex] || dateList[0]

  // この日付のタイムスロット定員情報
  const slotCapacities: SlotCapacity[] = timeSlotData
    .filter(s => s.is_available && (currentDate.id ? s.event_date_id === currentDate.id : true))
    .map(s => ({
      start: toMinutes(s.start_time),
      end: toMinutes(s.end_time),
      capacity: s.capacity,
      slotId: s.id,
    }))

  const hasTimeSlots = slotCapacities.length > 0

  // この日付の予約をフィルタ
  const dayReservations = reservations.filter(r => {
    if (r.event_dates?.event_date) return r.event_dates.event_date === currentDate.date
    if (currentDate.id && r.event_date_id) return r.event_date_id === currentDate.id
    return true
  })

  // 時間軸の範囲（30分刻み）
  const dayStart = Math.floor(toMinutes(currentDate.start) / 30) * 30
  const dayEnd = Math.ceil(toMinutes(currentDate.end) / 30) * 30
  const timeSlots: number[] = []
  for (let i = 0; i <= (dayEnd - dayStart) / 30; i++) {
    timeSlots.push(dayStart + i * 30)
  }

  // ステータス集計
  const statusCounts = dayReservations.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1
    return acc
  }, {})

  // 全体の空き状況
  const activeCount = dayReservations.filter(r => isActiveReservation(r.status)).reduce((s, r) => s + r.participant_count, 0)
  const totalCapacity = hasTimeSlots
    ? slotCapacities.reduce((s, c) => s + c.capacity, 0)
    : currentDate.capacity

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/admin/events">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">予約状況</h1>
      </div>
      <EventTabs />

      {/* Date Navigation */}
      {dateList.length > 1 && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedDateIndex(i => Math.max(0, i - 1))}
            disabled={selectedDateIndex === 0}
            className="rounded-md p-1 hover:bg-gray-100 disabled:opacity-30"
          >
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div className="flex gap-2 overflow-x-auto">
            {dateList.map((d, i) => (
              <button
                key={d.date}
                onClick={() => setSelectedDateIndex(i)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  i === selectedDateIndex
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {formatDate(d.date)}
              </button>
            ))}
          </div>
          <button
            onClick={() => setSelectedDateIndex(i => Math.min(dateList.length - 1, i + 1))}
            disabled={selectedDateIndex === dateList.length - 1}
            className="rounded-md p-1 hover:bg-gray-100 disabled:opacity-30"
          >
            <ChevronRight className="h-5 w-5 text-gray-600" />
          </button>
        </div>
      )}

      {/* Status Summary + Capacity */}
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-sm font-semibold text-gray-900">{formatDate(currentDate.date)}</span>
        <div className={`rounded-lg px-3 py-1 text-sm font-medium ${
          totalCapacity - activeCount > 0
            ? 'bg-green-50 text-green-700'
            : 'bg-red-50 text-red-700'
        }`}>
          {activeCount}/{totalCapacity}名
          <span className="ml-1 text-xs">
            （残り{Math.max(0, totalCapacity - activeCount)}名）
          </span>
        </div>
        {Object.entries(RESERVATION_STATUS_LABELS).map(([status, label]) => {
          const count = statusCounts[status] || 0
          if (count === 0) return null
          return (
            <div key={status} className="flex items-center gap-1.5 text-sm">
              <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT_COLOR[status] || 'bg-gray-300'}`} />
              <span className="text-gray-600">{label} {count}</span>
            </div>
          )
        })}
      </div>

      {/* Timetable */}
      <Card className="overflow-x-auto">
        <div className="min-w-[500px]">
          {timeSlots.map((slotMin, i) => {
            if (i === timeSlots.length - 1) return null

            const slotEnd = slotMin + 30
            const timeLabel = fromMinutes(slotMin)
            const isHour = slotMin % 60 === 0

            // このスロットに開始する予約
            const slotReservations: ReservationWithSlot[] = []
            for (const r of dayReservations) {
              const t = getSlotTime(r, event)
              if (t.start >= slotMin && t.start < slotEnd) {
                slotReservations.push(r)
              }
            }

            // このスロットにマッチするタイムスロット定員
            const matchingCapacity = slotCapacities.find(c => c.start >= slotMin && c.start < slotEnd)

            // このスロットの定員に対するアクティブ予約数
            let capacityInfo: { booked: number; capacity: number } | null = null
            if (matchingCapacity) {
              const booked = dayReservations
                .filter(r => {
                  const t = getSlotTime(r, event)
                  return t.start === matchingCapacity.start && t.end === matchingCapacity.end && isActiveReservation(r.status)
                })
                .reduce((s, r) => s + r.participant_count, 0)
              capacityInfo = { booked, capacity: matchingCapacity.capacity }
            }

            // 背景色を空き状況で決定
            const bgColor = capacityInfo
              ? capacityInfo.booked >= capacityInfo.capacity
                ? 'bg-red-50'
                : capacityInfo.booked >= capacityInfo.capacity * 0.8
                  ? 'bg-yellow-50'
                  : capacityInfo.booked > 0
                    ? 'bg-green-50'
                    : 'bg-emerald-50'
              : ''

            return (
              <div key={slotMin} className={`flex border-t ${isHour ? 'border-gray-300' : 'border-gray-100'}`}>
                {/* Time label */}
                <div className="flex w-16 flex-shrink-0 items-start justify-end pr-3 pt-1">
                  {isHour && (
                    <span className="text-xs font-medium text-gray-500">{timeLabel}</span>
                  )}
                </div>

                {/* Content area */}
                <div className={`min-h-[48px] flex-1 border-l border-gray-200 py-1 pl-3 pr-2 ${bgColor}`}>
                  {/* Capacity label */}
                  {capacityInfo && (
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[11px] text-gray-500">
                        {fromMinutes(slotMin)}〜{matchingCapacity ? fromMinutes(matchingCapacity.end) : ''}
                      </span>
                      <span className={`text-[11px] font-semibold ${
                        capacityInfo.booked >= capacityInfo.capacity ? 'text-red-600' :
                        capacityInfo.booked >= capacityInfo.capacity * 0.8 ? 'text-yellow-600' :
                        'text-green-600'
                      }`}>
                        {capacityInfo.booked >= capacityInfo.capacity
                          ? '満席'
                          : `空き${capacityInfo.capacity - capacityInfo.booked}名`
                        }
                        {' '}({capacityInfo.booked}/{capacityInfo.capacity})
                      </span>
                    </div>
                  )}

                  {/* Reservations */}
                  {slotReservations.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {slotReservations.map(r => (
                        <button
                          key={r.id}
                          onClick={() => openDetail(r)}
                          className={`cursor-pointer rounded-md border px-2 py-1 text-xs transition-shadow hover:shadow-md ${STATUS_BG_COLOR[r.status] || 'bg-gray-50 border-gray-200 text-gray-700'}`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_COLOR[r.status]}`} />
                            <span className="font-medium">{r.name}</span>
                            <span className="opacity-70">{r.participant_count}名</span>
                            <span className="opacity-60">{RESERVATION_STATUS_LABELS[r.status]}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Empty slot - available */}
                  {slotReservations.length === 0 && capacityInfo && capacityInfo.booked < capacityInfo.capacity && (
                    <span className="text-xs text-green-500">予約可能</span>
                  )}
                </div>
              </div>
            )
          })}
          {/* 最後の時間ライン */}
          <div className="flex border-t border-gray-300">
            <div className="flex w-16 flex-shrink-0 items-start justify-end pr-3 pt-1">
              <span className="text-xs font-medium text-gray-500">{fromMinutes(dayEnd)}</span>
            </div>
            <div className="flex-1 border-l border-gray-200" />
          </div>
        </div>
      </Card>

      {/* No reservations */}
      {dayReservations.length === 0 && (
        <EmptyState icon={Clock} title="この日の予約はありません" />
      )}

      {/* Reservation Detail Modal */}
      <Modal
        isOpen={!!selectedReservation}
        onClose={() => { setSelectedReservation(null); setDetailData(null) }}
        title={selectedReservation ? `${selectedReservation.name} さんの詳細` : '予約詳細'}
        size="xl"
      >
        {selectedReservation && (
          <div className="space-y-5">
            {/* Customer Profile Header */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                    <User className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{selectedReservation.name}</p>
                    <p className="text-sm text-gray-500">{selectedReservation.email}</p>
                  </div>
                </div>
                {detailData?.customer && (
                  <Link
                    to={`/admin/customers/${detailData.customer.id}`}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-500"
                    onClick={() => { setSelectedReservation(null); setDetailData(null) }}
                  >
                    カルテを開く
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div>
                  <span className="text-xs text-gray-500">電話番号</span>
                  <p className="text-gray-900">{selectedReservation.phone}</p>
                </div>
                {detailData?.customer?.prefecture && (
                  <div>
                    <span className="text-xs text-gray-500">都道府県</span>
                    <p className="text-gray-900">{detailData.customer.prefecture}</p>
                  </div>
                )}
                {detailData?.customer?.age_group && (
                  <div>
                    <span className="text-xs text-gray-500">年代</span>
                    <p className="text-gray-900">{detailData.customer.age_group}</p>
                  </div>
                )}
                <div>
                  <span className="text-xs text-gray-500">通算参加</span>
                  <p className="font-bold text-blue-600">
                    {detailLoading ? '...' : `${(detailData?.participationCount ?? 0) + (detailData?.activities.length ?? 0)}回`}
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
                    <p className="text-gray-900">{getSlotLabel(selectedReservation, event)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">参加人数</span>
                    <p className="text-gray-900">{selectedReservation.participant_count}名</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">ステータス</span>
                    <p>
                      <Badge variant={
                        selectedReservation.status === 'confirmed' ? 'success' :
                        selectedReservation.status === 'pending_approval' ? 'warning' :
                        selectedReservation.status === 'rejected' || selectedReservation.status === 'cancelled' ? 'danger' :
                        selectedReservation.status === 'attended' ? 'info' : 'default'
                      }>
                        {RESERVATION_STATUS_LABELS[selectedReservation.status] || selectedReservation.status}
                      </Badge>
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">予約日時</span>
                    <p className="text-gray-900">{formatDateTime(selectedReservation.created_at)}</p>
                  </div>
                </div>
                {selectedReservation.note && (
                  <div className="mt-2 border-t border-gray-100 pt-2 text-sm">
                    <span className="text-xs text-gray-500">備考</span>
                    <p className="text-gray-900">{selectedReservation.note}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            {selectedReservation.status === 'pending_approval' && (
              <div className="flex gap-2">
                <button
                  onClick={() => handleStatusChange(selectedReservation.id, 'confirmed')}
                  className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                >
                  承認する
                </button>
                <button
                  onClick={() => handleStatusChange(selectedReservation.id, 'rejected')}
                  className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  却下する
                </button>
              </div>
            )}

            {/* Caution + Survey */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-2 flex items-center gap-1.5">
                  <ClipboardCheck className="h-4 w-4 text-gray-600" />
                  <h3 className="text-sm font-semibold text-gray-900">注意事項</h3>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                  {selectedReservation.agreed_to_caution ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="font-medium text-green-700">承諾済み</span>
                      </div>
                      {selectedReservation.agreed_at && (
                        <p className="text-xs text-gray-500">{formatDateTime(selectedReservation.agreed_at)}</p>
                      )}
                      {selectedReservation.caution_version && (
                        <p className="text-xs text-gray-500">v{selectedReservation.caution_version}</p>
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

              <div>
                <div className="mb-2 flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-gray-600" />
                  <h3 className="text-sm font-semibold text-gray-900">アンケート</h3>
                </div>
                {detailLoading ? (
                  <div className="flex justify-center rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <LoadingSpinner size="sm" />
                  </div>
                ) : !detailData || detailData.surveyAnswers.length === 0 ? (
                  <p className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">回答なし</p>
                ) : (
                  <div className="space-y-1.5">
                    {detailData.surveyAnswers.map((a) => (
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
            {detailData?.customer?.memo && (
              <div>
                <div className="mb-2 flex items-center gap-1.5">
                  <StickyNote className="h-4 w-4 text-gray-600" />
                  <h3 className="text-sm font-semibold text-gray-900">管理者メモ</h3>
                </div>
                <p className="whitespace-pre-wrap rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-gray-800">
                  {detailData.customer.memo}
                </p>
              </div>
            )}

            {/* Activity History */}
            {!detailLoading && detailData && detailData.activities.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-1.5">
                  <BookOpen className="h-4 w-4 text-gray-600" />
                  <h3 className="text-sm font-semibold text-gray-900">
                    活動履歴<span className="ml-1 font-normal text-gray-400">（直近5件）</span>
                  </h3>
                </div>
                <div className="space-y-1.5">
                  {detailData.activities.slice(0, 5).map((act) => (
                    <div key={act.id} className="rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">{formatDate(act.activity_date)}</span>
                        <span className="font-medium text-gray-900">{act.title}</span>
                      </div>
                      {act.plan && <p className="mt-0.5 text-xs text-gray-600">プラン: {act.plan}</p>}
                      {act.memo && <p className="mt-0.5 text-xs text-gray-500">{act.memo}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Past Reservations */}
            {!detailLoading && detailData && detailData.pastReservations.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-1.5">
                  <Ticket className="h-4 w-4 text-gray-600" />
                  <h3 className="text-sm font-semibold text-gray-900">
                    過去の予約<span className="ml-1 font-normal text-gray-400">（直近5件）</span>
                  </h3>
                </div>
                <div className="space-y-1.5">
                  {detailData.pastReservations.slice(0, 5).map((pr) => (
                    <div key={pr.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900">{pr.events?.title ?? '(不明)'}</p>
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
                      <Badge variant={
                        pr.status === 'confirmed' ? 'success'
                          : pr.status === 'attended' ? 'info'
                          : pr.status === 'cancelled' ? 'default'
                          : pr.status === 'no_show' ? 'danger'
                          : 'default'
                      }>
                        {RESERVATION_STATUS_LABELS[pr.status] ?? pr.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Guest hint */}
            {!detailLoading && detailData && !detailData.customer && (
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
