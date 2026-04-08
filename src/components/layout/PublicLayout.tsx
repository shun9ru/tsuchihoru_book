import { Link, Outlet } from 'react-router-dom'
import { LogOut, User } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export default function PublicLayout() {
  const { isCustomer, isAdmin, customer, signOut } = useAuth()

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors">
            イベント予約システム
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              to="/"
              className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors"
            >
              トップ
            </Link>
            {isAdmin && (
              <Link
                to="/admin"
                className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors"
              >
                管理画面
              </Link>
            )}
            {isCustomer ? (
              <>
                <Link
                  to="/mypage"
                  className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-500 transition-colors"
                >
                  <User className="h-4 w-4" />
                  {customer?.name ?? 'マイページ'}
                </Link>
                <button
                  onClick={() => signOut()}
                  className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : !isAdmin ? (
              <Link
                to="/login"
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                ログイン
              </Link>
            ) : null}
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t bg-white py-6">
        <div className="mx-auto max-w-5xl px-4 text-center text-sm text-gray-500 sm:px-6 lg:px-8">
          &copy; {new Date().getFullYear()} イベント予約システム All rights reserved.
        </div>
      </footer>
    </div>
  )
}
