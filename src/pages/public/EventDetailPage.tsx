import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Calendar, Clock, MapPin, Wallet, Users, Target, Briefcase, ArrowLeft } from 'lucide-react'
import { eventsApi, timeSlotsApi, eventDatesApi } from '@/lib/api'
import { Button, Card, Badge, LoadingSpinner } from '@/components/ui'
import { cn, formatDate, formatTime, formatCurrency, formatDateTime, isWithinReservationPeriod, getRemainingCapacity } from '@/lib/utils'
import type { Event, EventTimeSlot, EventDate } from '@/types'

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [event, setEvent] = useState<Event | null>(null)
  const [confirmedCount, setConfirmedCount] = useState(0)
  const [timeSlots, setTimeSlots] = useState<Array<EventTimeSlot & { reserved_count: number; remaining: number }>>([])
  const [eventDates, setEventDates] = useState<Array<EventDate & { reserved_count: number; remaining: number }>>([])
  const [dateSlotsMap, setDateSlotsMap] = useState<Record<string, Array<EventTimeSlot & { reserved_count: number; remaining: number }>>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchEvent() {
      if (!id) return

      try {
        setLoading(true)
        const [eventData, count] = await Promise.all([
          eventsApi.getEvent(id),
          eventsApi.getConfirmedParticipantCount(id),
        ])
        setEvent(eventData)
        setConfirmedCount(count)

        if (eventData.use_multi_dates) {
          const [dates, dateCounts] = await Promise.all([
            eventDatesApi.getEventDates(eventData.id),
            eventDatesApi.getDateReservationCounts(eventData.id),
          ])
          const datesWithCounts = dates.filter(d => d.is_available).map(d => ({
            ...d,
            reserved_count: dateCounts[d.id] || 0,
            remaining: d.capacity - (dateCounts[d.id] || 0),
          }))
          setEventDates(datesWithCounts)

          // 複数日+時間割: 日程ごとのスロットを取得
          if (eventData.use_time_slots) {
            const slotsMap: Record<string, Array<EventTimeSlot & { reserved_count: number; remaining: number }>> = {}
            await Promise.all(datesWithCounts.map(async (d) => {
              const slots = await timeSlotsApi.getAvailableSlots(eventData.id, d.id)
              slotsMap[d.id] = slots
            }))
            setDateSlotsMap(slotsMap)
          }
        }

        // 単一日+時間割
        if (eventData.use_time_slots && !eventData.use_multi_dates) {
          const slots = await timeSlotsApi.getAvailableSlots(eventData.id)
          setTimeSlots(slots)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'イベント情報の取得に失敗しました')
      } finally {
        setLoading(false)
      }
    }

    fetchEvent()
  }, [id])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Card>
          <p className="text-center text-red-600">{error ?? 'イベントが見つかりません'}</p>
          <div className="mt-4 text-center">
            <Link to="/" className="text-blue-600 hover:underline">
              イベント一覧に戻る
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  const remaining = getRemainingCapacity(event.capacity, confirmedCount)
  const isFull = event.use_multi_dates
    ? eventDates.length > 0 && eventDates.every(d => d.remaining <= 0)
    : event.use_time_slots
      ? timeSlots.length > 0 && timeSlots.every(s => s.remaining <= 0)
      : confirmedCount >= event.capacity
  const withinPeriod = isWithinReservationPeriod(event.reservation_start_at, event.reservation_end_at)
  const canReserve = !isFull && withinPeriod && event.is_accepting

  function getDisabledReason(): string | null {
    if (isFull) return '定員に達しているため予約できません'
    if (!event!.is_accepting) return '現在予約を受け付けておりません'
    if (!withinPeriod) {
      if (event!.reservation_start_at && new Date() < new Date(event!.reservation_start_at)) {
        return `予約受付は ${formatDateTime(event!.reservation_start_at)} から開始されます`
      }
      return '予約受付期間が終了しました'
    }
    return null
  }

  const disabledReason = getDisabledReason()

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Back Link */}
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        イベント一覧に戻る
      </Link>

      <Card>
        {/* Title */}
        <h1 className="mb-6 text-2xl font-bold text-gray-900 sm:text-3xl">{event.title}</h1>

        {/* Event Info Grid */}
        <div className="mb-8 space-y-4">
          {/* Date */}
          {!event.use_multi_dates && (
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 shrink-0 text-blue-500" />
              <div>
                <span className="text-sm font-medium text-gray-500">開催日</span>
                <p className="text-gray-900">{formatDate(event.event_date)}</p>
              </div>
            </div>
          )}

          {/* Time */}
          {!event.use_multi_dates && (
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 shrink-0 text-blue-500" />
              <div>
                <span className="text-sm font-medium text-gray-500">時間</span>
                <p className="text-gray-900">
                  {formatTime(event.start_time)} 〜 {formatTime(event.end_time)}
                </p>
              </div>
            </div>
          )}

          {/* Multi-date schedule */}
          {event.use_multi_dates && eventDates.length > 0 && (
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
                <Calendar className="h-5 w-5 text-gray-500" />
                開催日程
              </h3>
              <div className="space-y-3">
                {eventDates.map(d => {
                  const dateSlots = dateSlotsMap[d.id] ?? []
                  return (
                    <div key={d.id} className="rounded-lg border border-gray-200 px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{formatDate(d.event_date)}</p>
                          <p className="text-sm text-gray-600">
                            {d.start_time.slice(0, 5)}{d.end_time ? ` 〜 ${d.end_time.slice(0, 5)}` : ''}
                          </p>
                        </div>
                        <Badge variant={d.remaining > 0 ? 'success' : 'danger'}>
                          {d.remaining > 0 ? `残り${d.remaining}枠` : '満席'}
                        </Badge>
                      </div>
                      {/* この日程の時間帯 */}
                      {dateSlots.length > 0 && (
                        <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                          {dateSlots.map(slot => (
                            <div
                              key={slot.id}
                              className={cn(
                                'rounded border px-2 py-1.5 text-center text-xs',
                                slot.remaining > 0
                                  ? 'border-green-200 bg-green-50'
                                  : 'border-red-200 bg-red-50'
                              )}
                            >
                              <p className="font-medium text-gray-900">
                                {slot.start_time.slice(0, 5)}〜{slot.end_time.slice(0, 5)}
                              </p>
                              <p className={slot.remaining > 0 ? 'text-green-700' : 'text-red-600'}>
                                {slot.remaining > 0 ? `残${slot.remaining}枠` : '満席'}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Location */}
          <div className="flex items-center gap-3">
            <MapPin className="h-5 w-5 shrink-0 text-blue-500" />
            <div>
              <span className="text-sm font-medium text-gray-500">会場</span>
              <p className="text-gray-900">{event.location}</p>
            </div>
          </div>

          {/* Fee */}
          <div className="flex items-center gap-3">
            <Wallet className="h-5 w-5 shrink-0 text-blue-500" />
            <div>
              <span className="text-sm font-medium text-gray-500">参加費</span>
              <p className="text-gray-900">
                {event.fee === 0 ? '無料' : formatCurrency(event.fee)}
              </p>
            </div>
          </div>

          {/* Capacity */}
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 shrink-0 text-blue-500" />
            <div>
              <span className="text-sm font-medium text-gray-500">定員</span>
              <div className="flex items-center gap-2">
                <p className="text-gray-900">
                  {confirmedCount} / {event.capacity}名
                </p>
                {isFull ? (
                  <Badge variant="danger">満席</Badge>
                ) : (
                  <Badge variant={remaining <= 5 ? 'warning' : 'success'}>
                    残り{remaining}名
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Target Audience */}
          {event.target_audience && (
            <div className="flex items-center gap-3">
              <Target className="h-5 w-5 shrink-0 text-blue-500" />
              <div>
                <span className="text-sm font-medium text-gray-500">対象</span>
                <p className="text-gray-900">{event.target_audience}</p>
              </div>
            </div>
          )}

          {/* Belongings */}
          {event.belongings && (
            <div className="flex items-center gap-3">
              <Briefcase className="h-5 w-5 shrink-0 text-blue-500" />
              <div>
                <span className="text-sm font-medium text-gray-500">持ち物</span>
                <p className="text-gray-900">{event.belongings}</p>
              </div>
            </div>
          )}
        </div>

        {/* Description */}
        {event.description && (
          <div className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-gray-900">イベント詳細</h2>
            <p className="whitespace-pre-wrap text-gray-700 leading-relaxed">
              {event.description}
            </p>
          </div>
        )}

        {/* Reservation Period */}
        {(event.reservation_start_at || event.reservation_end_at) && (
          <div className="mb-8 rounded-lg bg-gray-50 p-4">
            <h3 className="mb-1 text-sm font-medium text-gray-500">予約受付期間</h3>
            <p className="text-gray-900">
              {event.reservation_start_at ? formatDateTime(event.reservation_start_at) : '制限なし'}
              {' 〜 '}
              {event.reservation_end_at ? formatDateTime(event.reservation_end_at) : '制限なし'}
            </p>
          </div>
        )}

        {/* Time Slots (single date only - multi-date slots shown above in each date) */}
        {event.use_time_slots && !event.use_multi_dates && timeSlots.length > 0 && (
          <div className="border-t border-gray-200 pt-6">
            <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-gray-900">
              <Clock className="h-5 w-5 text-gray-500" />
              予約可能な時間帯
            </h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {timeSlots.map((slot) => (
                <div
                  key={slot.id}
                  className={cn(
                    'rounded-lg border p-3 text-center text-sm',
                    slot.remaining > 0
                      ? 'border-green-200 bg-green-50'
                      : 'border-red-200 bg-red-50'
                  )}
                >
                  <p className="font-medium text-gray-900">
                    {slot.start_time.slice(0, 5)} 〜 {slot.end_time.slice(0, 5)}
                  </p>
                  <p className={cn(
                    'mt-1 text-xs',
                    slot.remaining > 0 ? 'text-green-700' : 'text-red-600'
                  )}>
                    {slot.remaining > 0 ? `残り${slot.remaining}枠` : '満席'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reserve Button */}
        <div className="border-t border-gray-200 pt-6">
          {isFull && event.is_accepting ? (
            <>
              <Link to={`/events/${event.id}/waitlist`} className="block">
                <Button
                  size="lg"
                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-white"
                >
                  キャンセル待ちに登録する
                </Button>
              </Link>
              <p className="mt-2 text-center text-sm text-yellow-700">
                定員に達していますが、キャンセル待ちに登録できます
              </p>
            </>
          ) : (
            <>
              <Button
                size="lg"
                className="w-full"
                disabled={!canReserve}
                onClick={() => navigate(`/events/${event.id}/reserve`)}
              >
                予約する
              </Button>
              {disabledReason && (
                <p className="mt-2 text-center text-sm text-red-600">{disabledReason}</p>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  )
}
