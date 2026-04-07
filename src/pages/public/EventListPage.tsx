import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, MapPin, Users } from 'lucide-react'
import { eventsApi } from '@/lib/api'
import { Card, Badge, LoadingSpinner, EmptyState } from '@/components/ui'
import { formatDate, formatCurrency, isWithinReservationPeriod, getRemainingCapacity } from '@/lib/utils'
import type { Event } from '@/types'

export default function EventListPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [participantCounts, setParticipantCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    async function fetchEvents() {
      try {
        setLoading(true)
        const data = await eventsApi.getPublishedEvents()
        setEvents(data)

        // Fetch participant counts for all events in parallel
        const counts = await Promise.all(
          data.map(async (event) => {
            try {
              const count = await eventsApi.getConfirmedParticipantCount(event.id)
              return { id: event.id, count }
            } catch {
              return { id: event.id, count: 0 }
            }
          })
        )

        const countsMap: Record<string, number> = {}
        for (const { id, count } of counts) {
          countsMap[id] = count
        }
        setParticipantCounts(countsMap)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'イベント一覧の取得に失敗しました')
      } finally {
        setLoading(false)
      }
    }

    fetchEvents()
  }, [])

  function getEventStatus(event: Event): { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' } | null {
    const remaining = getRemainingCapacity(event.capacity, participantCounts[event.id] ?? 0)

    if (remaining <= 0) {
      return { label: '満席', variant: 'danger' }
    }

    if (!event.is_accepting) {
      return { label: '受付停止中', variant: 'default' }
    }

    const withinPeriod = isWithinReservationPeriod(event.reservation_start_at, event.reservation_end_at)

    if (!withinPeriod) {
      if (event.reservation_start_at && new Date() < new Date(event.reservation_start_at)) {
        return { label: '受付開始前', variant: 'info' }
      }
      return { label: '受付終了', variant: 'default' }
    }

    return { label: `残り${remaining}名`, variant: remaining <= 5 ? 'warning' : 'success' }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <Card>
          <p className="text-center text-red-600">{error}</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Hero Section */}
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">イベント一覧</h1>
        <p className="mt-3 text-lg text-gray-600">
          開催予定のイベントをご確認いただき、お気軽にご予約ください。
        </p>
      </div>

      {/* Event Grid */}
      {events.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="現在公開中のイベントはありません"
          description="新しいイベントが公開されるまでお待ちください。"
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => {
            const status = getEventStatus(event)

            return (
              <Link key={event.id} to={`/events/${event.id}`} className="block">
                <Card className="h-full transition-shadow hover:shadow-md">
                  <div className="flex h-full flex-col">
                    {/* Title & Badge */}
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <h2 className="text-lg font-semibold text-gray-900 line-clamp-2">
                        {event.title}
                      </h2>
                      {status && (
                        <Badge variant={status.variant} className="shrink-0">
                          {status.label}
                        </Badge>
                      )}
                    </div>

                    {/* Event Info */}
                    <div className="mt-auto space-y-2 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 shrink-0 text-gray-400" />
                        <span>{formatDate(event.event_date)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 shrink-0 text-gray-400" />
                        <span className="truncate">{event.location}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 shrink-0 text-gray-400" />
                        <span>定員 {event.capacity}名</span>
                      </div>
                    </div>

                    {/* Fee */}
                    <div className="mt-4 border-t border-gray-100 pt-3">
                      <span className="text-lg font-bold text-gray-900">
                        {event.fee === 0 ? '無料' : formatCurrency(event.fee)}
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
