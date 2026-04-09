import { supabase } from '@/lib/supabase'
import type { Customer, CustomerInsert, CustomerUpdate } from '@/types'

/** 全顧客一覧取得（管理者用） */
export async function getCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`顧客一覧の取得に失敗しました: ${error.message}`)
  }

  return data
}

/** 顧客詳細取得 */
export async function getCustomer(id: string): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    throw new Error(`顧客情報の取得に失敗しました: ${error.message}`)
  }

  return data
}

/** auth_user_id で顧客取得 */
export async function getCustomerByAuthId(authUserId: string): Promise<Customer | null> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  if (error) {
    throw new Error(`顧客情報の取得に失敗しました: ${error.message}`)
  }

  return data
}

/** メールアドレスで顧客取得 */
export async function getCustomerByEmail(email: string): Promise<Customer | null> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('email', email)
    .maybeSingle()

  if (error) {
    throw new Error(`顧客情報の取得に失敗しました: ${error.message}`)
  }

  return data
}

/** 顧客作成 */
export async function createCustomer(data: CustomerInsert): Promise<Customer> {
  const { data: customer, error } = await supabase
    .from('customers')
    .insert(data)
    .select()
    .single()

  if (error) {
    throw new Error(`顧客の登録に失敗しました: ${error.message}`)
  }

  return customer
}

/** 顧客更新 */
export async function updateCustomer(id: string, data: CustomerUpdate): Promise<Customer> {
  const { data: customer, error } = await supabase
    .from('customers')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`顧客情報の更新に失敗しました: ${error.message}`)
  }

  return customer
}

/** 顧客の予約履歴取得（イベント情報付き、メールアドレス一致のゲスト予約も含む） */
export async function getCustomerReservations(customerId: string, email: string) {
  // customer_id で紐付いた予約
  const { data: byId, error: err1 } = await supabase
    .from('reservations')
    .select('*, events(id, title, event_date, start_time, end_time, location)')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })

  if (err1) {
    throw new Error(`予約履歴の取得に失敗しました: ${err1.message}`)
  }

  // メールアドレスが一致するゲスト予約（customer_id が null のもの）
  const { data: byEmail, error: err2 } = await supabase
    .from('reservations')
    .select('*, events(id, title, event_date, start_time, end_time, location)')
    .eq('email', email)
    .is('customer_id', null)
    .order('created_at', { ascending: false })

  if (err2) {
    throw new Error(`予約履歴の取得に失敗しました: ${err2.message}`)
  }

  // 重複排除してマージ
  const seen = new Set(byId.map(r => r.id))
  const merged = [...byId]
  for (const r of byEmail) {
    if (!seen.has(r.id)) merged.push(r)
  }

  // 日付降順で並び替え
  merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  return merged
}

/** 顧客の予約に紐づくアンケート回答取得（メールアドレス一致のゲスト予約も含む） */
export async function getCustomerSurveyAnswers(customerId: string, email: string) {
  // customer_id またはメールアドレスで予約を取得
  const { data: byId } = await supabase
    .from('reservations')
    .select('id')
    .eq('customer_id', customerId)

  const { data: byEmail } = await supabase
    .from('reservations')
    .select('id')
    .eq('email', email)
    .is('customer_id', null)

  const allIds = [...(byId ?? []), ...(byEmail ?? [])].map(r => r.id)
  if (allIds.length === 0) return []

  const { data: answers, error: ansError } = await supabase
    .from('survey_answers')
    .select('*, survey_questions(question_text, question_type)')
    .in('reservation_id', allIds)

  if (ansError) {
    throw new Error(`アンケート回答の取得に失敗しました: ${ansError.message}`)
  }

  return answers
}

/** 顧客一覧（予約数付き、管理者用） */
export async function getCustomersWithReservationCount(): Promise<
  Array<Customer & { reservation_count: number }>
> {
  const customers = await getCustomers()

  const withCounts = await Promise.all(
    customers.map(async (customer) => {
      const { count, error } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('customer_id', customer.id)

      return {
        ...customer,
        reservation_count: error ? 0 : (count ?? 0),
      }
    })
  )

  return withCounts
}
