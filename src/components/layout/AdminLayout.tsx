import { useState } from 'react'
import { Link, Outlet, useLocation, useParams } from 'react-router-dom'
import {
  LayoutDashboard,
  Calendar,
  Users,
  FileText,
  BarChart3,
  Mail,
  History,
  LogOut,
  Menu,
  X,
  Layers,
  UserPlus,
  Bell,
  Clock,
  UserCircle,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

const mainNavItems = [
  { label: 'ダッシュボード', path: '/admin', icon: LayoutDashboard },
  { label: 'イベント管理', path: '/admin/events', icon: Calendar },
  { label: '顧客管理', path: '/admin/customers', icon: UserCircle },
  { label: 'テンプレート管理', path: '/admin/templates', icon: Layers },
]

const eventSubNavItems = [
  { label: '予約者一覧', path: 'reservations', icon: Users },
  { label: '注意事項', path: 'caution', icon: FileText },
  { label: 'アンケート', path: 'survey', icon: FileText },
  { label: '統計', path: 'stats', icon: BarChart3 },
  { label: 'キャンセル待ち', path: 'waitlist', icon: UserPlus },
  { label: 'メール送信', path: 'email', icon: Mail },
  { label: '配信履歴', path: 'email/history', icon: History },
  { label: 'リマインド', path: 'reminders', icon: Bell },
  { label: '時間割', path: 'time-slots', icon: Clock },
  { label: '開催日', path: 'dates', icon: Calendar },
]

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const { id: eventId } = useParams()
  const { user, signOut } = useAuth()

  // Determine if we're on an event-specific page
  const isEventPage = location.pathname.match(/^\/admin\/events\/[^/]+/)

  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin'
    }
    return location.pathname.startsWith(path)
  }

  const isEventSubActive = (subPath: string) => {
    if (!eventId) return false
    return location.pathname === `/admin/events/${eventId}/${subPath}`
  }

  const handleSignOut = async () => {
    await signOut()
  }

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Sidebar header */}
      <div className="flex h-16 items-center justify-between border-b px-4">
        <Link to="/admin" className="text-lg font-bold text-gray-900">
          管理画面
        </Link>
        <button
          onClick={() => setSidebarOpen(false)}
          className="rounded-md p-1 text-gray-500 hover:bg-gray-100 lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {mainNavItems.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive(item.path)
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>

        {/* Event sub-navigation */}
        {isEventPage && eventId && (
          <div className="mt-6">
            <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
              イベント詳細
            </h3>
            <ul className="space-y-1">
              {eventSubNavItems.map((item) => {
                const Icon = item.icon
                return (
                  <li key={item.path}>
                    <Link
                      to={`/admin/events/${eventId}/${item.path}`}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        isEventSubActive(item.path)
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </nav>

      {/* User info and logout */}
      <div className="border-t p-4">
        <div className="mb-2 truncate text-sm text-gray-600">
          {user?.email}
        </div>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          ログアウト
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col">
        {/* Top header */}
        <header className="flex h-16 items-center gap-4 border-b bg-white px-4 shadow-sm lg:px-8">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-1 text-gray-500 hover:bg-gray-100 lg:hidden"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex-1" />
          <span className="hidden text-sm text-gray-600 sm:block">
            {user?.email}
          </span>
        </header>

        {/* Main content */}
        <main className="flex-1 px-4 py-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
