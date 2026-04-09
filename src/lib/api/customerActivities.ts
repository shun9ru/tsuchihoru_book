import { supabase } from '@/lib/supabase'
import type { CustomerActivity, CustomerActivityInsert, CustomerActivityUpdate } from '@/types'

/** 顧客の活動履歴一覧取得（日付降順） */
export async function getActivities(customerId: string): Promise<CustomerActivity[]> {
  const { data, error } = await supabase
    .from('customer_activities')
    .select('*')
    .eq('customer_id', customerId)
    .order('activity_date', { ascending: false })

  if (error) {
    throw new Error(`活動履歴の取得に失敗しました: ${error.message}`)
  }

  return data
}

/** 活動履歴を追加 */
export async function createActivity(data: CustomerActivityInsert): Promise<CustomerActivity> {
  const { data: activity, error } = await supabase
    .from('customer_activities')
    .insert(data)
    .select()
    .single()

  if (error) {
    throw new Error(`活動履歴の追加に失敗しました: ${error.message}`)
  }

  return activity
}

/** 活動履歴を更新 */
export async function updateActivity(id: string, data: CustomerActivityUpdate): Promise<CustomerActivity> {
  const { data: activity, error } = await supabase
    .from('customer_activities')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`活動履歴の更新に失敗しました: ${error.message}`)
  }

  return activity
}

/** 活動履歴を削除 */
export async function deleteActivity(id: string): Promise<void> {
  const { error } = await supabase
    .from('customer_activities')
    .delete()
    .eq('id', id)

  if (error) {
    throw new Error(`活動履歴の削除に失敗しました: ${error.message}`)
  }
}
