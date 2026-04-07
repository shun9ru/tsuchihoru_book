import { supabase } from '@/lib/supabase'
import type { BulkEmail, BulkEmailInsert, BulkEmailLog } from '@/types'
import { getReservationEmails } from './reservations'

/** 一斉メール作成（下書き保存） */
export async function createBulkEmail(data: BulkEmailInsert): Promise<BulkEmail> {
  const { data: email, error } = await supabase
    .from('bulk_emails')
    .insert(data)
    .select()
    .single()

  if (error) {
    throw new Error(`一斉メールの作成に失敗しました: ${error.message}`)
  }

  return email
}

/** 一斉メール送信実行 */
export async function sendBulkEmail(emailId: string): Promise<BulkEmail> {
  // 1. メール情報を取得
  const { data: bulkEmail, error: fetchError } = await supabase
    .from('bulk_emails')
    .select('*')
    .eq('id', emailId)
    .single()

  if (fetchError) {
    throw new Error(`メール情報の取得に失敗しました: ${fetchError.message}`)
  }

  // 2. ステータスを'sending'に更新
  const { error: statusError } = await supabase
    .from('bulk_emails')
    .update({ status: 'sending' })
    .eq('id', emailId)

  if (statusError) {
    throw new Error(`メールステータスの更新に失敗しました: ${statusError.message}`)
  }

  // 3. 予約者のメールアドレス一覧を取得
  const recipients = await getReservationEmails(bulkEmail.event_id)

  // 4. 配信ログエントリを作成
  if (recipients.length > 0) {
    const logEntries = recipients.map((r) => ({
      bulk_email_id: emailId,
      reservation_id: r.id,
      email: r.email,
      send_status: 'pending' as const,
    }))

    const { error: logError } = await supabase
      .from('bulk_email_logs')
      .insert(logEntries)

    if (logError) {
      throw new Error(`配信ログの作成に失敗しました: ${logError.message}`)
    }
  }

  // 5. ステータスを'sent'に更新（実際のメール送信はEdge Functionで行う想定）
  // TODO: Supabase Edge Functionを呼び出して実際にメールを送信する
  const { data: updatedEmail, error: updateError } = await supabase
    .from('bulk_emails')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      target_count: recipients.length,
    })
    .eq('id', emailId)
    .select()
    .single()

  if (updateError) {
    throw new Error(`メール送信完了ステータスの更新に失敗しました: ${updateError.message}`)
  }

  return updatedEmail
}

/** メール配信履歴一覧 */
export async function getBulkEmails(eventId: string): Promise<BulkEmail[]> {
  const { data, error } = await supabase
    .from('bulk_emails')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`メール配信履歴の取得に失敗しました: ${error.message}`)
  }

  return data
}

/** メール配信ログ取得 */
export async function getBulkEmailLogs(emailId: string): Promise<BulkEmailLog[]> {
  const { data, error } = await supabase
    .from('bulk_email_logs')
    .select('*')
    .eq('bulk_email_id', emailId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`メール配信ログの取得に失敗しました: ${error.message}`)
  }

  return data
}

/** テスト送信（Supabase Edge Functionを呼ぶ想定、ここではモック） */
export async function sendTestEmail(
  to: string,
  subject: string,
  body: string
): Promise<void> {
  // TODO: 実際のEdge Function呼び出しに置き換える
  // const { error } = await supabase.functions.invoke('send-email', {
  //   body: { to, subject, body },
  // })

  console.log('テストメール送信（モック）:', { to, subject, body })

  // モックでは常に成功とする
  return Promise.resolve()
}
