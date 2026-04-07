import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import EventTabs from '@/components/admin/EventTabs'
import {
  ArrowLeft,
  Users,
  Ticket,
  BarChart3,
  ClipboardCheck,
  AlertTriangle,
  MessageSquare,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { eventsApi, statsApi, surveysApi } from '@/lib/api'
import { Button, Card, LoadingSpinner, EmptyState } from '@/components/ui'
import { QUESTION_TYPE_LABELS } from '@/lib/constants'
import type { Event, EventStats, SurveyQuestion, SurveyAnswer } from '@/types'

const COLORS = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#F97316',
  '#14B8A6',
  '#6366F1',
]

interface SurveyResult {
  question: SurveyQuestion
  answers: SurveyAnswer[]
  optionCounts?: Record<string, number>
}

export default function StatsPage() {
  const { id: eventId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [event, setEvent] = useState<Event | null>(null)
  const [stats, setStats] = useState<EventStats | null>(null)
  const [dailyCounts, setDailyCounts] = useState<
    Array<{ date: string; count: number }>
  >([])
  const [surveyResults, setSurveyResults] = useState<SurveyResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!eventId) return
    try {
      setLoading(true)
      setError(null)

      const [eventData, statsData, dailyData, surveyData] = await Promise.all([
        eventsApi.getEvent(eventId),
        statsApi.getEventStats(eventId),
        statsApi.getDailyReservationCounts(eventId),
        surveysApi.getSurveyResults(eventId),
      ])

      setEvent(eventData)
      setStats(statsData)
      setDailyCounts(dailyData)
      setSurveyResults(surveyData)
    } catch (err) {
      setError(err instanceof Error ? err.message : '読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (error && !event) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Card className="text-center">
          <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-red-400" />
          <p className="text-red-600">{error}</p>
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() => navigate(-1)}
          >
            戻る
          </Button>
        </Card>
      </div>
    )
  }

  if (!event || !stats) return null

  const capacityPercent = Math.round(
    (stats.totalParticipants / event.capacity) * 100
  )

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">統計情報</h1>
        <p className="mt-1 text-sm text-gray-500">{event.title}</p>
      </div>
      <div className="mb-6"><EventTabs /></div>

      {/* Section 1: Overview Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Reservations / Capacity */}
        <Card>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2">
              <Ticket className="h-5 w-5 text-blue-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-500">予約数 / 定員</p>
              <p className="text-lg font-bold text-gray-900">
                {stats.totalReservations}{' '}
                <span className="text-sm font-normal text-gray-400">
                  / {event.capacity}
                </span>
              </p>
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>参加率</span>
              <span>{capacityPercent}%</span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-blue-600 transition-all"
                style={{ width: `${Math.min(capacityPercent, 100)}%` }}
              />
            </div>
          </div>
        </Card>

        {/* Total Participants */}
        <Card>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2">
              <Users className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">参加者数</p>
              <p className="text-lg font-bold text-gray-900">
                {stats.totalParticipants}
                <span className="ml-1 text-sm font-normal text-gray-400">
                  名
                </span>
              </p>
            </div>
          </div>
        </Card>

        {/* Remaining Seats */}
        <Card>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-yellow-100 p-2">
              <BarChart3 className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">残席数</p>
              <p className="text-lg font-bold text-gray-900">
                {stats.remainingCapacity}
                <span className="ml-1 text-sm font-normal text-gray-400">
                  席
                </span>
              </p>
            </div>
          </div>
        </Card>

        {/* Survey Response Count */}
        <Card>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-100 p-2">
              <ClipboardCheck className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">アンケート回答数</p>
              <p className="text-lg font-bold text-gray-900">
                {stats.surveyResponseCount}
                <span className="ml-1 text-sm font-normal text-gray-400">
                  件
                </span>
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Section 2: Daily Reservation Chart */}
      <Card className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          日別予約数
        </h2>
        {dailyCounts.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="予約データがありません"
            className="py-8"
          />
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyCounts}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value: string) => {
                    const parts = value.split('-')
                    return `${parts[1]}/${parts[2]}`
                  }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  labelFormatter={(label) => `日付: ${label}`}
                  formatter={(value) => [`${value} 件`, '予約数']}
                />
                <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Section 3: Survey Results */}
      <div className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          アンケート結果
        </h2>

        {surveyResults.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="アンケート設問がありません"
            description="アンケートが設定されていないか、回答がまだありません"
          />
        ) : (
          <div className="space-y-6">
            {surveyResults.map((result) => (
              <Card key={result.question.id}>
                <div className="mb-3 flex items-center gap-2">
                  <h3 className="font-medium text-gray-900">
                    {result.question.question_text}
                  </h3>
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                    {QUESTION_TYPE_LABELS[result.question.question_type] ??
                      result.question.question_type}
                  </span>
                  <span className="text-xs text-gray-400">
                    ({result.answers.length} 件)
                  </span>
                </div>

                {result.question.question_type === 'free_text' ? (
                  // Free text answers
                  <FreeTextResults answers={result.answers} />
                ) : (
                  // Choice results
                  <ChoiceResults optionCounts={result.optionCounts ?? {}} />
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// --- Sub-components ---

function ChoiceResults({
  optionCounts,
}: {
  optionCounts: Record<string, number>
}) {
  const entries = Object.entries(optionCounts)
  const total = entries.reduce((sum, [, count]) => sum + count, 0)

  if (entries.length === 0) {
    return (
      <p className="text-sm italic text-gray-400">回答データがありません</p>
    )
  }

  const chartData = entries.map(([name, value]) => ({ name, value }))

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {/* Pie Chart */}
      <div className="flex items-center justify-center">
        <div className="h-48 w-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={70}
                dataKey="value"
                label={({ name, percent }: { name?: string; percent?: number }) =>
                  `${name ?? ''} (${((percent ?? 0) * 100).toFixed(0)}%)`
                }
                labelLine={false}
              >
                {chartData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [`${value} 件`, '回答数']}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {entries.map(([option, count], index) => (
          <div key={option} className="flex items-center gap-3">
            <span
              className="h-3 w-3 flex-shrink-0 rounded-full"
              style={{
                backgroundColor: COLORS[index % COLORS.length],
              }}
            />
            <span className="min-w-0 flex-1 truncate text-sm text-gray-700">
              {option}
            </span>
            <span className="text-sm font-medium text-gray-900">
              {count}
            </span>
            <span className="text-xs text-gray-400">
              ({total > 0 ? Math.round((count / total) * 100) : 0}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function FreeTextResults({ answers }: { answers: SurveyAnswer[] }) {
  const textAnswers = answers
    .map((a) => a.answer_text)
    .filter((t): t is string => !!t && t.trim() !== '')

  if (textAnswers.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <MessageSquare className="h-4 w-4" />
        <span>回答がありません</span>
      </div>
    )
  }

  return (
    <div>
      <p className="mb-2 text-xs text-gray-500">
        {textAnswers.length} 件の回答
      </p>
      <div className="max-h-60 space-y-2 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3">
        {textAnswers.map((text, index) => (
          <div
            key={index}
            className="rounded-md bg-white px-3 py-2 text-sm text-gray-700 shadow-sm"
          >
            {text}
          </div>
        ))}
      </div>
    </div>
  )
}
