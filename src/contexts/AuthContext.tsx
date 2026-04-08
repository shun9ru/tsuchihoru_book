import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { customersApi } from '@/lib/api'
import type { User } from '@supabase/supabase-js'
import type { Customer } from '@/types'

interface AuthContextType {
  user: User | null
  loading: boolean
  isAdmin: boolean
  isCustomer: boolean
  customer: Customer | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (data: { email: string; password: string; name: string; prefecture?: string; age_group?: string }) => Promise<void>
  signOut: () => Promise<void>
  refreshCustomer: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [customer, setCustomer] = useState<Customer | null>(null)

  const isCustomer = !!customer

  /** auth.users の id で管理者か顧客かを判定 */
  const resolveRole = useCallback(async (authUser: User | null) => {
    if (!authUser) {
      setIsAdmin(false)
      setCustomer(null)
      return
    }

    // public.users にレコードがあれば管理者
    // customers にレコードがあれば顧客
    try {
      const [adminResult, customerResult] = await Promise.all([
        supabase.from('users').select('id').eq('id', authUser.id).maybeSingle(),
        customersApi.getCustomerByAuthId(authUser.id).catch(() => null),
      ])
      setIsAdmin(!!adminResult.data)
      setCustomer(customerResult)
    } catch {
      // DB クエリ失敗時は未認証扱い
      setIsAdmin(false)
      setCustomer(null)
    }
  }, [])

  useEffect(() => {
    // Get current session on mount
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const authUser = session?.user ?? null
      setUser(authUser)
      await resolveRole(authUser)
      setLoading(false)
    })

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const authUser = session?.user ?? null
      setUser(authUser)
      await resolveRole(authUser)
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [resolveRole])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      throw error
    }
  }

  const signUp = async (data: {
    email: string
    password: string
    name: string
    prefecture?: string
    age_group?: string
  }) => {
    // Supabase Auth にユーザー作成
    // メタデータに顧客情報を含め、DB トリガー (handle_new_user) が customers レコードを作成する
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          role: 'customer',
          name: data.name,
          prefecture: data.prefecture || '',
          age_group: data.age_group || '',
        },
      },
    })

    if (authError) {
      throw new Error(`アカウント登録に失敗しました: ${authError.message}`)
    }

    if (!authData.user) {
      throw new Error('アカウント登録に失敗しました')
    }

    // トリガーが作成した顧客レコードを取得
    // セッションが未確立（メール確認待ち）の場合は null になる
    const newCustomer = await customersApi.getCustomerByAuthId(authData.user.id)
    setCustomer(newCustomer)
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      throw error
    }
    setUser(null)
    setIsAdmin(false)
    setCustomer(null)
  }

  const refreshCustomer = useCallback(async () => {
    if (!user) return
    const updated = await customersApi.getCustomerByAuthId(user.id)
    setCustomer(updated)
  }, [user])

  return (
    <AuthContext.Provider
      value={{ user, loading, isAdmin, isCustomer, customer, signIn, signUp, signOut, refreshCustomer }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
