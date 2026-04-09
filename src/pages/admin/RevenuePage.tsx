import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import EventTabs from '@/components/admin/EventTabs'
import {
  Plus,
  Trash2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  Users,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts'
import { eventsApi, expensesApi, statsApi } from '@/lib/api'
import { Button, Card, Input, LoadingSpinner, EmptyState } from '@/components/ui'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { formatCurrency } from '@/lib/utils'
import type { Event, EventExpense, EventStats } from '@/types'

export default function RevenuePage() {
  const { id: eventId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [event, setEvent] = useState<Event | null>(null)
  const [stats, setStats] = useState<EventStats | null>(null)
  const [expenses, setExpenses] = useState<EventExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 新規支出フォーム
  const [newName, setNewName] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [adding, setAdding] = useState(false)

  // 削除確認
  const [deleteTarget, setDeleteTarget] = useState<EventExpense | null>(null)

  // インライン編集
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editAmount, setEditAmount] = useState('')

  const fetchData = useCallback(async () => {
    if (!eventId) return
    try {
      setLoading(true)
      setError(null)
      const [eventData, statsData, expensesData] = await Promise.all([
        eventsApi.getEvent(eventId),
        statsApi.getEventStats(eventId),
        expensesApi.getExpenses(eventId),
      ])
      setEvent(eventData)
      setStats(statsData)
      setExpenses(expensesData)
    } catch (err) {
      setError(err instanceof Error ? err.message : '読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleAddExpense = async () => {
    if (!eventId || !newName.trim() || !newAmount) return
    try {
      setAdding(true)
      const created = await expensesApi.createExpense({
        event_id: eventId,
        name: newName.trim(),
        amount: parseInt(newAmount, 10),
        sort_order: expenses.length,
      })
      setExpenses((prev) => [...prev, created])
      setNewName('')
      setNewAmount('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '追加に失敗しました')
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await expensesApi.deleteExpense(deleteTarget.id)
      setExpenses((prev) => prev.filter((e) => e.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '削除に失敗しました')
    }
  }

  const startEdit = (expense: EventExpense) => {
    setEditingId(expense.id)
    setEditName(expense.name)
    setEditAmount(String(expense.amount))
  }

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim() || !editAmount) return
    try {
      const updated = await expensesApi.updateExpense(editingId, {
        name: editName.trim(),
        amount: parseInt(editAmount, 10),
      })
      setExpenses((prev) => prev.map((e) => (e.id === editingId ? updated : e)))
      setEditingId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新に失敗しました')
    }
  }

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
          <Button variant="secondary" className="mt-4" onClick={() => navigate(-1)}>
            戻る
          </Button>
        </Card>
      </div>
    )
  }

  if (!event || !stats) return null

  // 計算
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
  const confirmedIncome = event.fee * stats.totalParticipants
  const projectedIncome = event.fee * event.capacity
  const profit = confirmedIncome - totalExpenses
  const breakEvenCount = event.fee > 0 ? Math.ceil(totalExpenses / event.fee) : null
  const profitRate = confirmedIncome > 0 ? Math.round((profit / confirmedIncome) * 100) : 0

  // 損益分岐点チャートデータ
  const chartData = buildBreakEvenChart(event.fee, totalExpenses, event.capacity, stats.totalParticipants)

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">収支管理</h1>
        <p className="mt-1 text-sm text-gray-500">{event.title}</p>
      </div>
      <div className="mb-6"><EventTabs /></div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* サマリーカード */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 収入（確定） */}
        <Card>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-500">収入（確定）</p>
              <p className="text-lg font-bold text-gray-900">
                {formatCurrency(confirmedIncome)}
              </p>
              <p className="text-xs text-gray-400">
                {formatCurrency(event.fee)} × {stats.totalParticipants}名
              </p>
            </div>
          </div>
        </Card>

        {/* 支出合計 */}
        <Card>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-red-100 p-2">
              <TrendingDown className="h-5 w-5 text-red-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-500">支出合計</p>
              <p className="text-lg font-bold text-gray-900">
                {formatCurrency(totalExpenses)}
              </p>
              <p className="text-xs text-gray-400">
                {expenses.length}項目
              </p>
            </div>
          </div>
        </Card>

        {/* 損益 */}
        <Card>
          <div className="flex items-center gap-3">
            <div className={`rounded-lg p-2 ${profit >= 0 ? 'bg-blue-100' : 'bg-orange-100'}`}>
              <DollarSign className={`h-5 w-5 ${profit >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-500">損益</p>
              <p className={`text-lg font-bold ${profit >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                {profit >= 0 ? '+' : ''}{formatCurrency(profit)}
              </p>
              <p className="text-xs text-gray-400">
                利益率 {profitRate}%
              </p>
            </div>
          </div>
        </Card>

        {/* 損益分岐点 */}
        <Card>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-100 p-2">
              <Target className="h-5 w-5 text-purple-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-500">損益分岐点</p>
              {breakEvenCount !== null ? (
                <>
                  <p className="text-lg font-bold text-gray-900">
                    {breakEvenCount}
                    <span className="ml-1 text-sm font-normal text-gray-400">名</span>
                  </p>
                  <p className="text-xs text-gray-400">
                    現在 {stats.totalParticipants}名 / 定員{event.capacity}名
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-400">参加費が無料のため計算不可</p>
              )}
            </div>
          </div>
          {breakEvenCount !== null && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>達成状況</span>
                <span>
                  {stats.totalParticipants >= breakEvenCount ? '達成' : `あと${breakEvenCount - stats.totalParticipants}名`}
                </span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className={`h-full rounded-full transition-all ${
                    stats.totalParticipants >= breakEvenCount ? 'bg-green-500' : 'bg-purple-500'
                  }`}
                  style={{
                    width: `${Math.min(100, Math.round((stats.totalParticipants / breakEvenCount) * 100))}%`,
                  }}
                />
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* 収入見込み */}
      <Card className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">収入見込み</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500">参加費</p>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(event.fee)}</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-400" />
              <p className="text-xs text-gray-500">確定参加者の収入</p>
            </div>
            <p className="text-xl font-bold text-green-600">{formatCurrency(confirmedIncome)}</p>
            <p className="text-xs text-gray-400">{stats.totalParticipants}名確定</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500">満員時の最大収入</p>
            <p className="text-xl font-bold text-gray-600">{formatCurrency(projectedIncome)}</p>
            <p className="text-xs text-gray-400">定員{event.capacity}名</p>
          </div>
        </div>
      </Card>

      {/* 損益分岐点チャート */}
      {event.fee > 0 && totalExpenses > 0 && (
        <Card className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">損益分岐点チャート</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 25, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v: number) => `¥${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value) => [
                    formatCurrency(Number(value)),
                    '損益',
                  ]}
                  labelFormatter={(label) => `参加者数: ${label}`}
                />
                <ReferenceLine y={0} stroke="#9CA3AF" strokeDasharray="3 3" />
                {breakEvenCount !== null && (
                  <ReferenceLine
                    x={`${breakEvenCount}名`}
                    stroke="#8B5CF6"
                    strokeDasharray="5 5"
                    label={{ value: '損益分岐点', position: 'insideTopLeft', fontSize: 11, fill: '#8B5CF6', offset: 10 }}
                  />
                )}
                <ReferenceLine
                  x={`${stats.totalParticipants}名`}
                  stroke="#10B981"
                  strokeWidth={2}
                  strokeDasharray="4 2"
                  label={{ value: `現在 ${stats.totalParticipants}名`, position: 'insideTopRight', fontSize: 11, fill: '#10B981', offset: 10 }}
                />
                <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.profit >= 0 ? '#3B82F6' : '#F97316'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-center text-xs text-gray-400">
            横軸：参加者数 / 縦軸：損益（収入 − 支出）
          </p>
        </Card>
      )}

      {/* 支出一覧 */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">支出項目</h2>

        {expenses.length === 0 ? (
          <EmptyState
            icon={TrendingDown}
            title="支出項目がありません"
            description="下のフォームから支出項目を追加してください"
            className="py-8"
          />
        ) : (
          <div className="mb-6 divide-y divide-gray-100 rounded-lg border border-gray-200">
            {expenses.map((expense) => (
              <div key={expense.id} className="flex items-center gap-3 px-4 py-3">
                {editingId === expense.id ? (
                  <>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                    <input
                      type="number"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="w-32 rounded border border-gray-300 px-2 py-1 text-right text-sm"
                    />
                    <Button size="sm" onClick={handleSaveEdit}>保存</Button>
                    <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>
                      取消
                    </Button>
                  </>
                ) : (
                  <>
                    <span
                      className="min-w-0 flex-1 cursor-pointer text-sm text-gray-700 hover:text-blue-600"
                      onClick={() => startEdit(expense)}
                      title="クリックして編集"
                    >
                      {expense.name}
                    </span>
                    <span
                      className="cursor-pointer text-sm font-medium text-gray-900 hover:text-blue-600"
                      onClick={() => startEdit(expense)}
                    >
                      {formatCurrency(expense.amount)}
                    </span>
                    <button
                      onClick={() => setDeleteTarget(expense)}
                      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            ))}
            {/* 合計 */}
            <div className="flex items-center gap-3 bg-gray-50 px-4 py-3">
              <span className="min-w-0 flex-1 text-sm font-medium text-gray-700">合計</span>
              <span className="text-sm font-bold text-gray-900">
                {formatCurrency(totalExpenses)}
              </span>
              <div className="w-[28px]" />
            </div>
          </div>
        )}

        {/* 支出追加フォーム */}
        <div className="flex items-end gap-3">
          <Input
            label="項目名"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="例: 会場費、講師謝礼、備品"
          />
          <Input
            label="金額"
            type="number"
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
            placeholder="0"
            className="w-40"
          />
          <Button
            onClick={handleAddExpense}
            disabled={adding || !newName.trim() || !newAmount}
          >
            <Plus className="mr-1 h-4 w-4" />
            追加
          </Button>
        </div>
      </Card>

      {/* 削除確認ダイアログ */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="支出項目の削除"
        message={`「${deleteTarget?.name}」を削除しますか？`}
        confirmLabel="削除"
        variant="danger"
      />
    </div>
  )
}

/** 損益分岐点チャート用データを生成 */
function buildBreakEvenChart(
  fee: number,
  totalExpenses: number,
  capacity: number,
  currentCount: number
): Array<{ label: string; profit: number }> {
  if (fee <= 0 || capacity <= 0) return []

  const step = Math.max(1, Math.round(capacity / 10))
  const data: Array<{ label: string; profit: number }> = []

  for (let count = 0; count <= capacity; count += step) {
    data.push({
      label: `${count}名`,
      profit: fee * count - totalExpenses,
    })
  }

  // 最後のポイントが定員でない場合は追加
  if (data.length === 0 || data[data.length - 1].label !== `${capacity}名`) {
    data.push({
      label: `${capacity}名`,
      profit: fee * capacity - totalExpenses,
    })
  }

  // 損益分岐点を追加
  const breakEven = Math.ceil(totalExpenses / fee)
  if (breakEven <= capacity && !data.some((d) => d.label === `${breakEven}名`)) {
    data.push({
      label: `${breakEven}名`,
      profit: fee * breakEven - totalExpenses,
    })
  }

  // 現在の参加者数を追加
  if (currentCount >= 0 && currentCount <= capacity && !data.some((d) => d.label === `${currentCount}名`)) {
    data.push({
      label: `${currentCount}名`,
      profit: fee * currentCount - totalExpenses,
    })
  }

  data.sort((a, b) => parseInt(a.label) - parseInt(b.label))

  return data
}
