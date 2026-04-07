import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Users, Ticket, Plus, ArrowRight } from 'lucide-react'
import { eventsApi, reservationsApi } from '@/lib/api'
import { Button, Card, LoadingSpinner } from '@/components/ui'
import { formatDate, formatTime } from '@/lib/utils'
import type { Event } from '@/types'

interface DashboardStats {
  totalEvents: number
  upcomingEvents: number
  totalConfirmedReservations: number
}

interface UpcomingEventWithCount {
  event: Event
  reservationCount: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEventWithCount[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    try {
      const events = await eventsApi.getAllEvents()

      const today = new Date().toISOString().split('T')[0]
      const upcoming = events
        .filter((e) => e.event_date >= today)
        .sort((a, b) => a.event_date.localeCompare(b.event_date))

      // Fetch reservation counts for upcoming events (first 5)
      const upcomingSlice = upcoming.slice(0, 5)
      const upcomingWithCounts = await Promise.all(
        upcomingSlice.map(async (event) => {
          const reservations = await reservationsApi.getReservations(event.id)
          const confirmedCount = reservations.filter((r) => r.status === 'confirmed').length
          return { event, reservationCount: confirmedCount }
        })
      )

      // Calculate total confirmed reservations across all events
      let totalConfirmed = 0
      await Promise.all(
        events.map(async (event) => {
          const count = await eventsApi.getConfirmedParticipantCount(event.id)
          totalConfirmed += count
        })
      )

      setStats({
        totalEvents: events.length,
        upcomingEvents: upcoming.length,
        totalConfirmedReservations: totalConfirmed,
      })
      setUpcomingEvents(upcomingWithCounts)
    } catch (err) {
      console.error('ダッシュボードの読み込みに失敗しました:', err)
    } finally {
      setLoading(false)
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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>
          <p className="mt-1 text-sm text-gray-600">管理画面へようこそ</p>
        </div>
        <Link to="/admin/events/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            新規イベント作成
          </Button>
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
              <CalendarDays className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">全イベント数</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.totalEvents ?? 0}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
              <Ticket className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">開催予定イベント</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.upcomingEvents ?? 0}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">総予約参加者数</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.totalConfirmedReservations ?? 0}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Upcoming Events */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">開催予定イベント</h2>
        {upcomingEvents.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">
            開催予定のイベントはありません
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {upcomingEvents.map(({ event, reservationCount }) => (
              <Link
                key={event.id}
                to={`/admin/events/${event.id}/reservations`}
                className="flex items-center justify-between py-3 transition hover:bg-gray-50 -mx-6 px-6"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-900">{event.title}</p>
                  <p className="text-sm text-gray-500">
                    {formatDate(event.event_date)} {formatTime(event.start_time)}〜{formatTime(event.end_time)}
                  </p>
                </div>
                <div className="ml-4 flex items-center gap-3">
                  <span className="text-sm text-gray-600">
                    予約 <span className="font-semibold">{reservationCount}</span> / {event.capacity}
                  </span>
                  <ArrowRight className="h-4 w-4 text-gray-400" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
