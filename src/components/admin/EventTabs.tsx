import { Link, useLocation, useParams } from 'react-router-dom'
import { Users, FileText, BarChart3, Mail, UserPlus, Pencil, Clock, DollarSign } from 'lucide-react'

const tabs = [
  { label: '基本情報', path: 'edit', icon: Pencil },
  { label: '予約者一覧', path: 'reservations', icon: Users },
  { label: '予約状況', path: 'timeline', icon: Clock },
  { label: '注意事項', path: 'caution', icon: FileText },
  { label: 'アンケート', path: 'survey', icon: FileText },
  { label: '統計', path: 'stats', icon: BarChart3 },
  { label: '収支', path: 'revenue', icon: DollarSign },
  { label: 'メール', path: 'email', icon: Mail },
  { label: 'キャンセル待ち', path: 'waitlist', icon: UserPlus },
]

export default function EventTabs() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()

  const isNew = !id
  const isNewPage = location.pathname === '/admin/events/new'

  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-white p-1">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isFirstTab = tab.path === 'edit'
        const disabled = isNew && !isFirstTab

        // 新規作成時の基本情報タブ、または編集中のアクティブタブ判定
        const isActive = isNew
          ? isFirstTab
          : tab.path === 'email'
            ? location.pathname.startsWith(`/admin/events/${id}/${tab.path}`)
            : location.pathname === `/admin/events/${id}/${tab.path}`

        if (disabled) {
          return (
            <span
              key={tab.path}
              className="flex cursor-not-allowed items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-gray-300"
              title="イベントを保存してから利用できます"
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </span>
          )
        }

        const fullPath = isNewPage && isFirstTab
          ? '/admin/events/new'
          : `/admin/events/${id}/${tab.path}`

        return (
          <Link
            key={tab.path}
            to={fullPath}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
