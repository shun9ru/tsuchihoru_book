import { supabase } from '@/lib/supabase'
import type { ReminderJob } from '@/types'

/** リマインドジョブ一覧取得 */
export async function getReminderJobs(eventId: string): Promise<ReminderJob[]> {
  const { data, error } = await supabase
    .from('reminder_jobs')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`リマインドジョブ一覧の取得に失敗しました: ${error.message}`)
  }

  return data
}

/** リマインドジョブ作成/更新 (upsert by event_id + remind_type) */
export async function upsertReminderJob(data: {
  event_id: string
  remind_type: string
  subject: string
  body: string
  is_enabled: boolean
  scheduled_at?: string
}): Promise<ReminderJob> {
  const { data: job, error } = await supabase
    .from('reminder_jobs')
    .upsert(
      {
        event_id: data.event_id,
        remind_type: data.remind_type,
        subject: data.subject,
        body: data.body,
        is_enabled: data.is_enabled,
        scheduled_at: data.scheduled_at ?? null,
        status: 'pending',
      },
      {
        onConflict: 'event_id,remind_type',
      }
    )
    .select()
    .single()

  if (error) {
    throw new Error(`リマインドジョブの保存に失敗しました: ${error.message}`)
  }

  return job
}

/** リマインドジョブ削除 */
export async function deleteReminderJob(id: string): Promise<void> {
  const { error } = await supabase
    .from('reminder_jobs')
    .delete()
    .eq('id', id)

  if (error) {
    throw new Error(`リマインドジョブの削除に失敗しました: ${error.message}`)
  }
}

/** リマインドジョブの scheduled_at を計算するヘルパー */
export function calculateScheduledAt(eventDate: string, remindType: string): string {
  const date = new Date(eventDate)

  switch (remindType) {
    case '3_days_before':
      date.setDate(date.getDate() - 3)
      date.setHours(9, 0, 0, 0)
      break
    case '1_day_before':
      date.setDate(date.getDate() - 1)
      date.setHours(9, 0, 0, 0)
      break
    case 'morning_of':
      date.setHours(7, 0, 0, 0)
      break
    default:
      throw new Error(`不明なリマインドタイプ: ${remindType}`)
  }

  return date.toISOString()
}
