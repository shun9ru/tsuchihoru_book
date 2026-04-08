import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, Search } from 'lucide-react'
import { customersApi } from '@/lib/api'
import { Button, Card, Badge, LoadingSpinner, EmptyState, Input, Select } from '@/components/ui'
import { AGE_GROUP_OPTIONS, PREFECTURE_OPTIONS } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import type { Customer } from '@/types'

interface CustomerWithCount extends Customer {
  reservation_count: number
}

export default function CustomerListPage() {
  const [customers, setCustomers] = useState<CustomerWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterPrefecture, setFilterPrefecture] = useState('')
  const [filterAgeGroup, setFilterAgeGroup] = useState('')

  useEffect(() => {
    loadCustomers()
  }, [])

  async function loadCustomers() {
    try {
      const data = await customersApi.getCustomersWithReservationCount()
      setCustomers(data)
    } catch (err) {
      console.error('顧客一覧の取得に失敗しました:', err)
    } finally {
      setLoading(false)
    }
  }

  const filtered = customers.filter((c) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!c.name.toLowerCase().includes(q) && !c.email.toLowerCase().includes(q)) {
        return false
      }
    }
    if (filterPrefecture && c.prefecture !== filterPrefecture) return false
    if (filterAgeGroup && c.age_group !== filterAgeGroup) return false
    return true
  })

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">顧客管理</h1>
        <Badge variant="info">{customers.length}名</Badge>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="氏名・メールで検索"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <Select
            options={PREFECTURE_OPTIONS}
            placeholder="都道府県"
            value={filterPrefecture}
            onChange={(e) => setFilterPrefecture(e.target.value)}
            className="w-full sm:w-40"
          />
          <Select
            options={AGE_GROUP_OPTIONS}
            placeholder="年代"
            value={filterAgeGroup}
            onChange={(e) => setFilterAgeGroup(e.target.value)}
            className="w-full sm:w-32"
          />
          {(searchQuery || filterPrefecture || filterAgeGroup) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSearchQuery(''); setFilterPrefecture(''); setFilterAgeGroup('') }}
            >
              クリア
            </Button>
          )}
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-12 w-12" />}
          title="顧客が見つかりません"
          description={customers.length === 0
            ? '顧客がアカウント登録するとここに表示されます。'
            : '検索条件を変更してお試しください。'}
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm md:block">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">氏名</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">メール</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">都道府県</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">年代</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-500">予約数</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">登録日</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        to={`/admin/customers/${c.id}`}
                        className="font-medium text-blue-600 hover:text-blue-500"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.prefecture ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.age_group ?? '-'}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600">{c.reservation_count}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatDate(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {filtered.map((c) => (
              <Link key={c.id} to={`/admin/customers/${c.id}`}>
                <Card className="hover:border-blue-300 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900">{c.name}</div>
                      <div className="mt-0.5 text-sm text-gray-500">{c.email}</div>
                    </div>
                    <Badge variant="info">{c.reservation_count}件</Badge>
                  </div>
                  <div className="mt-2 flex gap-3 text-xs text-gray-500">
                    {c.prefecture && <span>{c.prefecture}</span>}
                    {c.age_group && <span>{c.age_group}</span>}
                    <span>{formatDate(c.created_at)}</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
