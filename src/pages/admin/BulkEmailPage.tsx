import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Send, Mail, Eye, FlaskConical, History, CheckCircle, FileText, BookmarkPlus } from 'lucide-react'
import { emailsApi, reservationsApi, eventsApi, templatesApi } from '@/lib/api'
import { Button, Card, Input, Textarea, LoadingSpinner, Modal, ConfirmDialog } from '@/components/ui'
import { formatDateTime } from '@/lib/utils'
import type { Event, EmailTemplate } from '@/types'

export default function BulkEmailPage() {
  const { id: eventId } = useParams<{ id: string }>()

  // Event & recipient data
  const [event, setEvent] = useState<Event | null>(null)
  const [recipientCount, setRecipientCount] = useState(0)
  const [loading, setLoading] = useState(true)

  // Form state
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [errors, setErrors] = useState<{ subject?: string; body?: string }>({})

  // Modal states
  const [testModalOpen, setTestModalOpen] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [testEmailError, setTestEmailError] = useState('')
  const [sendingTest, setSendingTest] = useState(false)
  const [testSent, setTestSent] = useState(false)

  const [previewModalOpen, setPreviewModalOpen] = useState(false)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [_sentEmailId, setSentEmailId] = useState<string | null>(null)

  // Template states
  const [templateModalOpen, setTemplateModalOpen] = useState(false)
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [saveTemplateModalOpen, setSaveTemplateModalOpen] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)

  // Fetch event and recipient count
  const fetchData = useCallback(async () => {
    if (!eventId) return
    try {
      setLoading(true)
      const [eventData, recipients] = await Promise.all([
        eventsApi.getEvent(eventId),
        reservationsApi.getReservationEmails(eventId),
      ])
      setEvent(eventData)
      setRecipientCount(recipients.length)
    } catch (err) {
      console.error('データの取得に失敗しました:', err)
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Validation
  function validate(): boolean {
    const newErrors: { subject?: string; body?: string } = {}
    if (!subject.trim()) {
      newErrors.subject = '件名は必須です'
    }
    if (!body.trim()) {
      newErrors.body = '本文は必須です'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Test send
  async function handleTestSend() {
    if (!testEmail.trim()) {
      setTestEmailError('メールアドレスを入力してください')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)) {
      setTestEmailError('有効なメールアドレスを入力してください')
      return
    }
    if (!validate()) {
      setTestModalOpen(false)
      return
    }

    try {
      setSendingTest(true)
      setTestEmailError('')
      await emailsApi.sendTestEmail(testEmail, subject, body)
      setTestSent(true)
      setTimeout(() => {
        setTestSent(false)
        setTestModalOpen(false)
      }, 2000)
    } catch (err) {
      setTestEmailError('テスト送信に失敗しました')
    } finally {
      setSendingTest(false)
    }
  }

  // Preview
  function getPreviewBody(): string {
    let preview = body
    preview = preview.replace(/\{\{name\}\}/g, '山田太郎')
    preview = preview.replace(/\{\{event_title\}\}/g, event?.title ?? 'イベント名')
    preview = preview.replace(/\{\{event_date\}\}/g, event?.event_date ?? '2026-01-01')
    return preview
  }

  // Send
  async function handleSend() {
    if (!eventId || sending) return

    try {
      setSending(true)
      setConfirmOpen(false)

      // 1. Save as draft
      const draft = await emailsApi.createBulkEmail({
        event_id: eventId,
        subject,
        body,
        status: 'draft',
      })

      // 2. Send
      await emailsApi.sendBulkEmail(draft.id)

      setSentEmailId(draft.id)
      setSent(true)
    } catch (err) {
      console.error('送信に失敗しました:', err)
      alert('メールの送信に失敗しました。もう一度お試しください。')
    } finally {
      setSending(false)
    }
  }

  // Template functions
  async function openTemplateModal() {
    setTemplateModalOpen(true)
    try {
      setTemplatesLoading(true)
      const data = await templatesApi.getEmailTemplates()
      setEmailTemplates(data)
    } catch {
      console.error('テンプレートの読み込みに失敗しました')
    } finally {
      setTemplatesLoading(false)
    }
  }

  function applyTemplate(template: EmailTemplate) {
    setSubject(template.subject)
    setBody(template.body)
    setErrors({})
    setTemplateModalOpen(false)
  }

  async function handleSaveAsTemplate() {
    if (!templateName.trim() || !subject.trim() || !body.trim()) return
    try {
      setSavingTemplate(true)
      await templatesApi.createEmailTemplate({
        name: templateName,
        subject,
        body,
      })
      setSaveTemplateModalOpen(false)
      setTemplateName('')
    } catch (err) {
      console.error('テンプレートの保存に失敗しました:', err)
    } finally {
      setSavingTemplate(false)
    }
  }

  function handleConfirmOpen() {
    if (!validate()) return
    setConfirmOpen(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!event) {
    return (
      <div className="py-20 text-center text-gray-500">
        イベントが見つかりませんでした
      </div>
    )
  }

  // Success state after sending
  if (sent) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Card className="text-center">
          <CheckCircle className="mx-auto mb-4 h-16 w-16 text-green-500" />
          <h2 className="mb-2 text-xl font-bold text-gray-900">送信完了</h2>
          <p className="mb-6 text-gray-600">
            {recipientCount}名へのメール送信が完了しました。
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link to={`/admin/events/${eventId}/emails/history`}>
              <Button variant="primary">
                <History className="mr-2 h-4 w-4" />
                配信履歴を確認
              </Button>
            </Link>
            <Button
              variant="secondary"
              onClick={() => {
                setSent(false)
                setSentEmailId(null)
                setSubject('')
                setBody('')
              }}
            >
              新しいメールを作成
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">一斉メール送信</h1>
          <p className="mt-1 text-sm text-gray-500">{event.title}</p>
        </div>
        <Link to={`/admin/events/${eventId}/emails/history`}>
          <Button variant="ghost" size="sm">
            <History className="mr-1.5 h-4 w-4" />
            配信履歴
          </Button>
        </Link>
      </div>

      {/* Target count */}
      <Card className="mb-6">
        <div className="flex items-center gap-3">
          <Mail className="h-5 w-5 text-blue-600" />
          <div>
            <span className="text-sm text-gray-600">送信対象: </span>
            <span className="text-lg font-bold text-blue-600">{recipientCount}名</span>
            <span className="ml-2 text-xs text-gray-400">（予約確定済みの参加者）</span>
          </div>
        </div>
      </Card>

      {/* Template buttons */}
      <div className="mb-4 flex gap-2">
        <Button variant="ghost" size="sm" onClick={openTemplateModal}>
          <FileText className="mr-1 h-4 w-4" />
          テンプレートから読み込み
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setTemplateName('')
            setSaveTemplateModalOpen(true)
          }}
          disabled={!subject.trim() || !body.trim()}
        >
          <BookmarkPlus className="mr-1 h-4 w-4" />
          テンプレートとして保存
        </Button>
      </div>

      {/* Form */}
      <Card className="mb-6 space-y-5">
        <Input
          label="件名"
          required
          value={subject}
          onChange={(e) => {
            setSubject(e.target.value)
            if (errors.subject) setErrors((prev) => ({ ...prev, subject: undefined }))
          }}
          placeholder="メールの件名を入力"
          error={errors.subject}
        />

        <Textarea
          label="本文"
          required
          rows={10}
          value={body}
          onChange={(e) => {
            setBody(e.target.value)
            if (errors.body) setErrors((prev) => ({ ...prev, body: undefined }))
          }}
          placeholder="メールの本文を入力"
          error={errors.body}
        />

        {/* Placeholder guide */}
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
          <p className="mb-2 text-xs font-medium text-gray-500">
            利用可能なプレースホルダー
          </p>
          <div className="space-y-1 text-xs text-gray-600">
            <div className="flex gap-2">
              <code className="rounded bg-gray-200 px-1.5 py-0.5 font-mono text-blue-700">
                {'{{name}}'}
              </code>
              <span>→ 参加者名</span>
            </div>
            <div className="flex gap-2">
              <code className="rounded bg-gray-200 px-1.5 py-0.5 font-mono text-blue-700">
                {'{{event_title}}'}
              </code>
              <span>→ イベント名</span>
            </div>
            <div className="flex gap-2">
              <code className="rounded bg-gray-200 px-1.5 py-0.5 font-mono text-blue-700">
                {'{{event_date}}'}
              </code>
              <span>→ イベント開催日</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button
          variant="ghost"
          onClick={() => {
            if (!validate()) return
            setTestModalOpen(true)
            setTestEmail('')
            setTestEmailError('')
            setTestSent(false)
          }}
          disabled={sending}
        >
          <FlaskConical className="mr-1.5 h-4 w-4" />
          テスト送信
        </Button>

        <Button
          variant="secondary"
          onClick={() => {
            if (!validate()) return
            setPreviewModalOpen(true)
          }}
          disabled={sending}
        >
          <Eye className="mr-1.5 h-4 w-4" />
          プレビュー
        </Button>

        <Button
          variant="primary"
          onClick={handleConfirmOpen}
          loading={sending}
          disabled={sending}
        >
          <Send className="mr-1.5 h-4 w-4" />
          送信する
        </Button>
      </div>

      {/* Test send modal */}
      <Modal
        isOpen={testModalOpen}
        onClose={() => setTestModalOpen(false)}
        title="テスト送信"
        size="sm"
      >
        {testSent ? (
          <div className="flex flex-col items-center py-4">
            <CheckCircle className="mb-2 h-10 w-10 text-green-500" />
            <p className="text-sm text-gray-600">テストメールを送信しました</p>
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-gray-600">
              テスト用のメールアドレスを入力してください。
              プレースホルダーはサンプル値に置換されます。
            </p>
            <Input
              label="送信先メールアドレス"
              type="email"
              value={testEmail}
              onChange={(e) => {
                setTestEmail(e.target.value)
                setTestEmailError('')
              }}
              placeholder="test@example.com"
              error={testEmailError}
            />
            <div className="mt-4 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setTestModalOpen(false)}>
                キャンセル
              </Button>
              <Button onClick={handleTestSend} loading={sendingTest}>
                送信
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* Preview modal */}
      <Modal
        isOpen={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        title="メールプレビュー"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <p className="mb-1 text-xs font-medium text-gray-500">件名</p>
            <p className="text-sm font-medium text-gray-900">{subject}</p>
          </div>
          <hr className="border-gray-200" />
          <div>
            <p className="mb-1 text-xs font-medium text-gray-500">本文</p>
            <div className="whitespace-pre-wrap rounded-lg border border-gray-100 bg-gray-50 p-4 text-sm text-gray-800">
              {getPreviewBody()}
            </div>
          </div>
          <p className="text-xs text-gray-400">
            ※ プレースホルダーはサンプル値に置換されています
          </p>
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="secondary" onClick={() => setPreviewModalOpen(false)}>
            閉じる
          </Button>
        </div>
      </Modal>

      {/* Confirm dialog */}
      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleSend}
        title="一斉メール送信の確認"
        message={`${recipientCount}名に一斉メールを送信します。この操作は取り消せません。`}
        confirmLabel="送信する"
        cancelLabel="キャンセル"
        variant="danger"
      />

      {/* Template Load Modal */}
      <Modal
        isOpen={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        title="メールテンプレートから読み込み"
        size="lg"
      >
        {templatesLoading ? (
          <div className="flex min-h-[120px] items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : emailTemplates.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">
            テンプレートがありません
          </p>
        ) : (
          <div className="max-h-[400px] space-y-2 overflow-y-auto">
            {emailTemplates.map((t) => (
              <button
                key={t.id}
                onClick={() => applyTemplate(t)}
                className="w-full rounded-lg border border-gray-200 p-3 text-left transition hover:border-blue-300 hover:bg-blue-50"
              >
                <p className="font-medium text-gray-900">{t.name}</p>
                <p className="mt-0.5 text-sm text-gray-500">
                  件名: {t.subject}
                </p>
                {t.description && (
                  <p className="mt-0.5 text-xs text-gray-400">{t.description}</p>
                )}
                <p className="mt-1 text-xs text-gray-400">
                  {formatDateTime(t.created_at)}
                </p>
              </button>
            ))}
          </div>
        )}
        <div className="mt-4 flex justify-end">
          <Button variant="secondary" onClick={() => setTemplateModalOpen(false)}>
            閉じる
          </Button>
        </div>
      </Modal>

      {/* Save as Template Modal */}
      <Modal
        isOpen={saveTemplateModalOpen}
        onClose={() => setSaveTemplateModalOpen(false)}
        title="テンプレートとして保存"
        size="sm"
      >
        <p className="mb-4 text-sm text-gray-600">
          現在の件名と本文をメールテンプレートとして保存します。
        </p>
        <Input
          label="テンプレート名"
          required
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          placeholder="例: 予約確認メール"
        />
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setSaveTemplateModalOpen(false)}>
            キャンセル
          </Button>
          <Button
            onClick={handleSaveAsTemplate}
            loading={savingTemplate}
            disabled={!templateName.trim()}
          >
            保存
          </Button>
        </div>
      </Modal>
    </div>
  )
}
