import { useState, useEffect } from 'react'
import { BarChart2, TrendingUp, Globe, Eye } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { analyticsApi } from '@/lib/api'
import { Card, Badge, LoadingSpinner, Select } from '@/components/ui'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1']

const PERIOD_OPTIONS = [
  { value: '7', label: '直近7日間' },
  { value: '30', label: '直近30日間' },
  { value: '90', label: '直近90日間' },
]

export default function AnalyticsPage() {
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [dailyPV, setDailyPV] = useState<Array<{ date: string; count: number }>>([])
  const [referrerStats, setReferrerStats] = useState<Array<{ source: string; count: number }>>([])
  const [popularPages, setPopularPages] = useState<Array<{ path: string; count: number }>>([])
  const [totalPV, setTotalPV] = useState(0)
  const [todayPV, setTodayPV] = useState(0)

  useEffect(() => {
    loadData()
  }, [days])

  async function loadData() {
    setLoading(true)
    try {
      const [daily, referrers, pages, total, today] = await Promise.all([
        analyticsApi.getDailyPageViews(days),
        analyticsApi.getReferrerStats(days),
        analyticsApi.getPopularPages(days),
        analyticsApi.getTotalPageViews(days),
        analyticsApi.getTodayPageViews(),
      ])
      setDailyPV(daily)
      setReferrerStats(referrers)
      setPopularPages(pages)
      setTotalPV(total)
      setTodayPV(today)
    } catch (err) {
      console.error('アクセス解析データの取得に失敗しました:', err)
    } finally {
      setLoading(false)
    }
  }

  const totalReferrers = referrerStats.reduce((sum, r) => sum + r.count, 0)

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">アクセス解析</h1>
        <Select
          options={PERIOD_OPTIONS}
          value={String(days)}
          onChange={(e) => setDays(Number(e.target.value))}
          className="w-40"
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-3">
              <Eye className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">本日のPV</p>
              <p className="text-2xl font-bold text-gray-900">{todayPV.toLocaleString()}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-3">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">期間合計PV</p>
              <p className="text-2xl font-bold text-gray-900">{totalPV.toLocaleString()}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-100 p-3">
              <Globe className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">流入元の数</p>
              <p className="text-2xl font-bold text-gray-900">{referrerStats.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Daily PV Chart */}
      <Card>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
          <BarChart2 className="h-5 w-5" />
          PV推移
        </h2>
        {dailyPV.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyPV}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => {
                  const d = new Date(v)
                  return `${d.getMonth() + 1}/${d.getDate()}`
                }}
                fontSize={12}
              />
              <YAxis allowDecimals={false} fontSize={12} />
              <Tooltip
                labelFormatter={(v) => {
                  const d = new Date(v as string)
                  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
                }}
                formatter={(value) => [`${value} PV`, 'ページビュー']}
              />
              <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-8 text-center text-sm text-gray-500">データがありません</p>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Referrer Pie Chart */}
        <Card>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
            <Globe className="h-5 w-5" />
            流入元の内訳
          </h2>
          {referrerStats.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={referrerStats}
                    dataKey="count"
                    nameKey="source"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={false}
                    labelLine={false}
                    fontSize={11}
                  >
                    {referrerStats.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, _name, props) => [
                      `${value} PV`,
                      analyticsApi.getReferrerLabel((props.payload as { source: string }).source),
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-1.5">
                {referrerStats.map((r, i) => (
                  <div key={r.source} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: COLORS[i % COLORS.length] }}
                      />
                      <span className="text-gray-700">{analyticsApi.getReferrerLabel(r.source)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{r.count}</span>
                      <span className="text-gray-400">
                        ({totalReferrers > 0 ? ((r.count / totalReferrers) * 100).toFixed(1) : 0}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="py-8 text-center text-sm text-gray-500">データがありません</p>
          )}
        </Card>

        {/* Popular Pages */}
        <Card>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
            <TrendingUp className="h-5 w-5" />
            人気ページ
          </h2>
          {popularPages.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={popularPages.slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} fontSize={12} />
                  <YAxis
                    type="category"
                    dataKey="path"
                    width={150}
                    fontSize={11}
                    tickFormatter={(v) => v.length > 25 ? v.slice(0, 25) + '...' : v}
                  />
                  <Tooltip formatter={(value) => [`${value} PV`, 'ページビュー']} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-1">
                {popularPages.map((p, i) => (
                  <div key={p.path} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant={i < 3 ? 'info' : 'default'}>{i + 1}</Badge>
                      <span className="truncate text-gray-700">{p.path}</span>
                    </div>
                    <span className="ml-2 flex-shrink-0 font-medium text-gray-900">{p.count} PV</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="py-8 text-center text-sm text-gray-500">データがありません</p>
          )}
        </Card>
      </div>
    </div>
  )
}
