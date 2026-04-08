import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

/** ログイン */
export async function signIn(
  email: string,
  password: string
): Promise<User> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    throw new Error(`ログインに失敗しました: ${error.message}`)
  }

  return data.user
}

/** 顧客アカウント登録 */
export async function signUp(
  email: string,
  password: string,
): Promise<User> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { role: 'customer' },
    },
  })

  if (error) {
    throw new Error(`アカウント登録に失敗しました: ${error.message}`)
  }

  if (!data.user) {
    throw new Error('アカウント登録に失敗しました')
  }

  return data.user
}

/** ログアウト */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()

  if (error) {
    throw new Error(`ログアウトに失敗しました: ${error.message}`)
  }
}

/** 現在のユーザー取得 */
export async function getCurrentUser(): Promise<User | null> {
  const { data, error } = await supabase.auth.getUser()

  if (error) {
    // セッションがない場合はnullを返す（エラーとしない）
    return null
  }

  return data.user
}

/** セッション監視 */
export function onAuthStateChange(
  callback: (user: User | null) => void
): { unsubscribe: () => void } {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null)
  })

  return { unsubscribe: () => subscription.unsubscribe() }
}
