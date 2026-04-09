import { supabase } from '@/lib/supabase'
import type { EventExpense, EventExpenseInsert, EventExpenseUpdate } from '@/types'

/** イベントの支出一覧取得 */
export async function getExpenses(eventId: string): Promise<EventExpense[]> {
  const { data, error } = await supabase
    .from('event_expenses')
    .select('*')
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true })

  if (error) throw new Error(`支出の取得に失敗しました: ${error.message}`)
  return data
}

/** 支出項目を追加 */
export async function createExpense(expense: EventExpenseInsert): Promise<EventExpense> {
  const { data, error } = await supabase
    .from('event_expenses')
    .insert(expense)
    .select()
    .single()

  if (error) throw new Error(`支出の追加に失敗しました: ${error.message}`)
  return data
}

/** 支出項目を更新 */
export async function updateExpense(id: string, expense: EventExpenseUpdate): Promise<EventExpense> {
  const { data, error } = await supabase
    .from('event_expenses')
    .update(expense)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`支出の更新に失敗しました: ${error.message}`)
  return data
}

/** 支出項目を削除 */
export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase
    .from('event_expenses')
    .delete()
    .eq('id', id)

  if (error) throw new Error(`支出の削除に失敗しました: ${error.message}`)
}
