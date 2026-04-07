import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Bell, Save, AlertTriangle, FileText } from 'lucide-react'
import { eventsApi, remindersApi, templatesApi } from '@/lib/api'
import {
  Button,
  Card,
  Input,
  Textarea,
  Checkbox,
  Badge,
  LoadingSpinner,
  Modal,
} from '@/components/ui'
import type { Event, ReminderJob, EmailTemplate } from '@/types'

type RemindType = '3_days_before' | '1_day_before' | 'morning_of'

interface ReminderCard {
  remind_type: RemindType
  label: string
  is_enabled: boolean
  subject: string
  body: string
  status: string | null
  sent_at: string | null
  scheduled_at: string | null
  saving: boolean
  saved: boolean
}

const REMIND_TYPES: { type: RemindType; label: string }[] = [
  { type: '3_days_before', label: '3日前リマインド' },
  { type: '1_day_before', label: '前日リマインド' },
  { type: 'morning_of', label: '当日朝リマインド' },
]

const DEFAULT_TEMPLATES: Record<RemindType, { subject: string; body: string }> = {
  '3_days_before': {
    subject: '【リマインド】{{event_title}} 開催のお知らせ',
    body: '{{name}} 様\n\n「{{event_title}}」の開催まであと3日となりました。\n\n■ 開催日時: {{event_date}}\n■ 会場: {{location}}\n\n当日お会いできることを楽しみにしております。',
  },
  '1_day_before': {
    subject: '【明日開催】{{event_title}}',
    body: '{{name}} 様\n\n「{{event_title}}」はいよいよ明日です。\n\n■ 開催日時: {{event_date}}\n■ 会場: {{location}}\n■ 持ち物: {{belongings}}\n\n準備をお忘れなく！',
  },
  morning_of: {
    subject: '【本日開催】{{event_title}}',
    body: '{{name}} 様\n\n「{{event_title}}」は本日開催です。\n\n■ 開始時間: {{start_time}}\n■ 会場: {{location}}\n\nお気をつけてお越しください。',
  },
}

export default function ReminderSettingsPage() {
  const { id: eventId } = useParams<{ id: string }>()

  const [event, setEvent] = useState<Event | null>(null)
  const [cards, setCards] = useState<ReminderCard[]>([])
  const [loading, setLoading] = useState(true)

  // Template loader modal
  const [templateModalOpen, setTemplateModalOpen] = useState(false)
  const [templateTargetType, setTemplateTargetType] = useState<RemindType | null>(null)
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)

  const isPastEvent = event ? new Date(event.event_date) < new Date() : false

  const fetchData = useCallback(async () => {
    if (!eventId) return
    try {
      setLoading(true)
      const [eventData, existingJobs] = await Promise.all([
        eventsApi.getEvent(eventId),
        remindersApi.getReminderJobs(eventId),
      ])
      setEvent(eventData)

      // Build cards from existing jobs or defaults
      const jobMap = new Map<string, ReminderJob>()
      for (const job of existingJobs) {
        jobMap.set(job.remind_type, job)
      }

      const initialCards: ReminderCard[] = REMIND_TYPES.map(({ type, label }) => {
        const existing = jobMap.get(type)
        const defaults = DEFAULT_TEMPLATES[type]
        const scheduledAt = remindersApi.calculateScheduledAt(eventData.event_date, type)

        if (existing) {
          return {
            remind_type: type,
            label,
            is_enabled: existing.is_enabled,
            subject: existing.subject,
            body: existing.body,
            status: existing.status,
            sent_at: existing.sent_at,
            scheduled_at: existing.scheduled_at ?? scheduledAt,
            saving: false,
            saved: false,
          }
        }

        return {
          remind_type: type,
          label,
          is_enabled: false,
          subject: defaults.subject,
          body: defaults.body,
          status: null,
          sent_at: null,
          scheduled_at: scheduledAt,
          saving: false,
          saved: false,
        }
      })

      setCards(initialCards)
    } catch (err) {
      console.error('データの取得に失敗しました:', err)
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  function updateCard(type: RemindType, updates: Partial<ReminderCard>) {
    setCards((prev) =>
      prev.map((c) => (c.remind_type === type ? { ...c, ...updates, saved: false } : c))
    )
  }

  async function handleSave(type: RemindType) {
    if (!eventId || !event) return

    const card = cards.find((c) => c.remind_type === type)
    if (!card) return

    updateCard(type, { saving: true })

    try {
      const scheduledAt = remindersApi.calculateScheduledAt(event.event_date, type)

      await remindersApi.upsertReminderJob({
        event_id: eventId,
        remind_type: type,
        subject: card.subject,
        body: card.body,
        is_enabled: card.is_enabled,
        scheduled_at: scheduledAt,
      })

      updateCard(type, { saving: false, saved: true, scheduled_at: scheduledAt })

      // Auto-dismiss saved indicator
      setTimeout(() => {
        setCards((prev) =>
          prev.map((c) => (c.remind_type === type ? { ...c, saved: false } : c))
        )
      }, 2000)
    } catch (err) {
      console.error('リマインド設定の保存に失敗しました:', err)
      updateCard(type, { saving: false })
      alert('保存に失敗しました。もう一度お試しください。')
    }
  }

  async function openTemplateModal(type: RemindType) {
    setTemplateTargetType(type)
    setTemplateModalOpen(true)
    setLoadingTemplates(true)
    try {
      const templates = await templatesApi.getEmailTemplates()
      setEmailTemplates(templates)
    } catch (err) {
      console.error('テンプレート一覧の取得に失敗しました:', err)
    } finally {
      setLoadingTemplates(false)
    }
  }

  function applyEmailTemplate(template: EmailTemplate) {
    if (!templateTargetType) return
    updateCard(templateTargetType, {
      subject: template.subject,
      body: template.body,
    })
    setTemplateModalOpen(false)
    setTemplateTargetType(null)
  }

  function formatScheduledAt(isoString: string | null): string {
    if (!isoString) return '-'
    const date = new Date(isoString)
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function getStatusBadge(status: string | null) {
    switch (status) {
      case 'sent':
        return <Badge variant="success">送信済み</Badge>
      case 'failed':
        return <Badge variant="danger">失敗</Badge>
      case 'skipped':
        return <Badge variant="default">スキップ</Badge>
      case 'pending':
        return <Badge variant="warning">未送信</Badge>
      default:
        return null
    }
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

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">リマインドメール設定</h1>
        <p className="mt-1 text-sm text-gray-500">{event.title}</p>
      </div>

      {/* Past event warning */}
      {isPastEvent && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-600" />
          <div>
            <p className="text-sm font-medium text-yellow-800">
              このイベントの開催日は過去の日付です
            </p>
            <p className="mt-1 text-xs text-yellow-700">
              リマインドメールは送信されません。設定の保存は可能です。
            </p>
          </div>
        </div>
      )}

      {/* Placeholder guide */}
      <Card className="mb-6">
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
          <p className="mb-2 text-xs font-medium text-gray-500">
            利用可能なプレースホルダー
          </p>
          <div className="grid grid-cols-2 gap-1 text-xs text-gray-600 sm:grid-cols-3">
            <div className="flex gap-1">
              <code className="rounded bg-gray-200 px-1 py-0.5 font-mono text-blue-700">
                {'{{name}}'}
              </code>
              <span>参加者名</span>
            </div>
            <div className="flex gap-1">
              <code className="rounded bg-gray-200 px-1 py-0.5 font-mono text-blue-700">
                {'{{event_title}}'}
              </code>
              <span>イベント名</span>
            </div>
            <div className="flex gap-1">
              <code className="rounded bg-gray-200 px-1 py-0.5 font-mono text-blue-700">
                {'{{event_date}}'}
              </code>
              <span>開催日</span>
            </div>
            <div className="flex gap-1">
              <code className="rounded bg-gray-200 px-1 py-0.5 font-mono text-blue-700">
                {'{{location}}'}
              </code>
              <span>会場</span>
            </div>
            <div className="flex gap-1">
              <code className="rounded bg-gray-200 px-1 py-0.5 font-mono text-blue-700">
                {'{{start_time}}'}
              </code>
              <span>開始時間</span>
            </div>
            <div className="flex gap-1">
              <code className="rounded bg-gray-200 px-1 py-0.5 font-mono text-blue-700">
                {'{{belongings}}'}
              </code>
              <span>持ち物</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Reminder cards */}
      <div className="space-y-6">
        {cards.map((card) => (
          <Card key={card.remind_type}>
            <div className="space-y-4">
              {/* Card header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="h-5 w-5 text-blue-600" />
                  <h2 className="text-lg font-semibold text-gray-900">{card.label}</h2>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(card.status)}
                </div>
              </div>

              {/* Enable toggle */}
              <Checkbox
                label="このリマインドを有効にする"
                checked={card.is_enabled}
                onChange={(e) =>
                  updateCard(card.remind_type, { is_enabled: e.target.checked })
                }
                disabled={card.status === 'sent'}
              />

              {/* Scheduled time info */}
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                <span className="font-medium">送信予定: </span>
                {formatScheduledAt(card.scheduled_at)}
                {card.sent_at && (
                  <span className="ml-4">
                    <span className="font-medium">送信済み: </span>
                    {formatScheduledAt(card.sent_at)}
                  </span>
                )}
              </div>

              {/* Subject */}
              <Input
                label="件名"
                value={card.subject}
                onChange={(e) =>
                  updateCard(card.remind_type, { subject: e.target.value })
                }
                placeholder="リマインドメールの件名"
                disabled={card.status === 'sent'}
              />

              {/* Body */}
              <Textarea
                label="本文"
                rows={6}
                value={card.body}
                onChange={(e) =>
                  updateCard(card.remind_type, { body: e.target.value })
                }
                placeholder="リマインドメールの本文"
                disabled={card.status === 'sent'}
              />

              {/* Actions */}
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openTemplateModal(card.remind_type)}
                  disabled={card.status === 'sent'}
                >
                  <FileText className="mr-1.5 h-4 w-4" />
                  テンプレートから読み込み
                </Button>
                <div className="flex items-center gap-3">
                  {card.saved && (
                    <span className="text-sm font-medium text-green-600">
                      保存しました
                    </span>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleSave(card.remind_type)}
                    loading={card.saving}
                    disabled={card.saving || card.status === 'sent'}
                  >
                    <Save className="mr-1.5 h-4 w-4" />
                    保存
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Template selection modal */}
      <Modal
        isOpen={templateModalOpen}
        onClose={() => {
          setTemplateModalOpen(false)
          setTemplateTargetType(null)
        }}
        title="テンプレートから読み込み"
        size="lg"
      >
        {loadingTemplates ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="md" />
          </div>
        ) : emailTemplates.length === 0 ? (
          <div className="py-8 text-center text-gray-500">
            <FileText className="mx-auto mb-2 h-8 w-8 text-gray-400" />
            <p className="text-sm">メールテンプレートがありません</p>
            <p className="mt-1 text-xs text-gray-400">
              テンプレート管理から作成してください
            </p>
          </div>
        ) : (
          <div className="max-h-96 space-y-3 overflow-y-auto">
            {emailTemplates.map((template) => (
              <button
                key={template.id}
                onClick={() => applyEmailTemplate(template)}
                className="w-full rounded-lg border border-gray-200 p-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50"
              >
                <p className="text-sm font-medium text-gray-900">
                  {template.name}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  件名: {template.subject}
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs text-gray-400">
                  {template.body}
                </p>
              </button>
            ))}
          </div>
        )}
        <div className="mt-4 flex justify-end">
          <Button
            variant="secondary"
            onClick={() => {
              setTemplateModalOpen(false)
              setTemplateTargetType(null)
            }}
          >
            閉じる
          </Button>
        </div>
      </Modal>
    </div>
  )
}
