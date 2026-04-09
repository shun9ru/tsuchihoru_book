/**
 * Supabase Edge Function: メール送信
 *
 * 予約確認メール、一斉メール送信に使用
 * Resend APIを使用（SendGridに切り替え可能）
 *
 * 環境変数:
 *   RESEND_API_KEY - Resend APIキー
 *   EMAIL_FROM     - 送信元メールアドレス
 */

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') || 'noreply@example.com'

interface EmailRequest {
  to: string
  subject: string
  body: string
  variables?: Record<string, string>
}

interface BulkEmailRequest {
  recipients: Array<{
    email: string
    name: string
    reservation_id?: string
  }>
  subject: string
  body: string
  bulk_email_id: string
  event_title?: string
  event_date?: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  const headers = { ...corsHeaders, 'Content-Type': 'application/json' }

  try {
    const { type, ...payload } = await req.json()

    if (!RESEND_API_KEY) {
      // API キー未設定時はログのみ出力（開発環境用）
      console.log('[send-email] API key not configured. Logging email:', payload)
      return new Response(
        JSON.stringify({ success: true, message: 'Email logged (API key not configured)' }),
        { headers }
      )
    }

    if (type === 'single') {
      // 単一メール送信（予約確認メールなど）
      const { to, subject, body, variables } = payload as EmailRequest
      let processedBody = body
      if (variables) {
        for (const [key, value] of Object.entries(variables)) {
          processedBody = processedBody.replace(new RegExp(`{{${key}}}`, 'g'), value)
        }
      }

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to: [to],
          subject,
          text: processedBody,
        }),
      })

      const data = await res.json()
      return new Response(JSON.stringify({ success: res.ok, data }), { headers })
    }

    if (type === 'bulk') {
      // 一斉メール送信
      const { recipients, subject, body, bulk_email_id, event_title, event_date } =
        payload as BulkEmailRequest

      const results = []
      for (const recipient of recipients) {
        try {
          // テンプレート変数を置換
          let processedBody = body
            .replace(/{{name}}/g, recipient.name)
            .replace(/{{event_title}}/g, event_title || '')
            .replace(/{{event_date}}/g, event_date || '')

          let processedSubject = subject
            .replace(/{{event_title}}/g, event_title || '')
            .replace(/{{event_date}}/g, event_date || '')

          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: EMAIL_FROM,
              to: [recipient.email],
              subject: processedSubject,
              text: processedBody,
            }),
          })

          results.push({
            email: recipient.email,
            reservation_id: recipient.reservation_id,
            success: res.ok,
            error: res.ok ? null : await res.text(),
          })
        } catch (err) {
          results.push({
            email: recipient.email,
            reservation_id: recipient.reservation_id,
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error',
          })
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          bulk_email_id,
          total: recipients.length,
          sent: results.filter((r) => r.success).length,
          failed: results.filter((r) => !r.success).length,
          results,
        }),
        { headers }
      )
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid email type' }),
      { headers, status: 400 }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : 'Unknown error' }),
      { headers, status: 500 }
    )
  }
})
