import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
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
  const initialized = useRef(false)

  const isCustomer = !!customer

  /** auth.users の id で管理者か顧客かを判定 */
  const resolveRole = useCallback(async (authUser: User | null) => {
    if (!authUser) {
      setIsAdmin(false)
      setCustomer(null)
      return
    }

    try {
      const [adminResult, customerResult] = await Promise.all([
        supabase.from('users').select('id').eq('id', authUser.id).maybeSingle(),
        customersApi.getCustomerByAuthId(authUser.id).catch(() => null),
      ])
      setIsAdmin(!!adminResult.data)
      setCustomer(customerResult)
    } catch {
      setIsAdmin(false)
      setCustomer(null)
    }
  }, [])

  useEffect(() => {
    // 1. getSession() で初期セッションを取得
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const authUser = session?.user ?? null
      setUser(authUser)
      await resolveRole(authUser)
      initialized.current = true
      setLoading(false)
    }).catch(() => {
      initialized.current = true
      setLoading(false)
    })

    // 2. onAuthStateChange はログイン/ログアウト等の変更のみ処理
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      // 初期化完了前の INITIAL_SESSION は getSession() が処理済みなのでスキップ
      if (!initialized.current) return

      const authUser = session?.user ?? null
      setUser(authUser)
      try {
        await resolveRole(authUser)
      } catch {
        // ignore
      }
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
