import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import EventTabs from '@/components/admin/EventTabs'
import { Eye, AlertTriangle, Info, FileText, BookmarkPlus } from 'lucide-react'
import { eventsApi, templatesApi } from '@/lib/api'
import { Button, Card, Input, Textarea, LoadingSpinner, Modal } from '@/components/ui'
import SaveStatus from '@/components/ui/SaveStatus'
import { useAutoSave } from '@/lib/useAutoSave'
import { formatDateTime } from '@/lib/utils'
import type { Event, CautionTemplate } from '@/types'

export default function CautionEditPage() {
  const { id: eventId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [event, setEvent] = useState<Event | null>(null)
  const [cautionText, setCautionText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  // Template states
  const [templateModalOpen, setTemplateModalOpen] = useState(false)
  const [templates, setTemplates] = useState<CautionTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [saveTemplateModalOpen, setSaveTemplateModalOpen] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)

  const fetchEvent = useCallback(async () => {
    if (!eventId) return
    try {
      setLoading(true)
      setError(null)
      const data = await eventsApi.getEvent(eventId)
      setEvent(data)
      setCautionText(data.caution_text ?? '')
    } catch (err) {
      setError(err instanceof Error ? err.message : '読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    fetchEvent()
  }, [fetchEvent])

  // 自動保存
  const autoSaveStatus = useAutoSave(
    async () => {
      if (!eventId || !event) return
      const updated = await eventsApi.updateEvent(eventId, {
        caution_text: cautionText || null,
        caution_version: event.caution_version + 1,
      })
      setEvent(updated)
    },
    [cautionText],
    2000,
    !loading && !!event,
  )

  // Template functions
  const openTemplateModal = async () => {
    setTemplateModalOpen(true)
    try {
      setTemplatesLoading(true)
      const data = await templatesApi.getCautionTemplates()
      setTemplates(data)
    } catch {
      setError('テンプレートの読み込みに失敗しました')
    } finally {
      setTemplatesLoading(false)
    }
  }

  const applyTemplate = (template: CautionTemplate) => {
    setCautionText(template.caution_text)
    setTemplateModalOpen(false)
  }

  const handleSaveAsTemplate = async () => {
    if (!templateName.trim() || !cautionText.trim()) return
    try {
      setSavingTemplate(true)
      await templatesApi.createCautionTemplate({
        name: templateName,
        caution_text: cautionText,
      })
      setSaveTemplateModalOpen(false)
      setTemplateName('')
      setSuccessMessage('テンプレートとして保存しました')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'テンプレートの保存に失敗しました')
    } finally {
      setSavingTemplate(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (error && !event) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Card className="text-center">
          <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-red-400" />
          <p className="text-red-600">{error}</p>
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() => navigate(-1)}
          >
            戻る
          </Button>
        </Card>
      </div>
    )
  }

  if (!event) return null

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">注意事項の編集</h1>
          <SaveStatus status={autoSaveStatus} />
        </div>
        <p className="mt-1 text-sm text-gray-500">{event.title}</p>
      </div>
      <div className="mb-6"><EventTabs /></div>

      {/* Status Messages */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Version Info */}
      <Card className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Info className="h-4 w-4 text-blue-500" />
          <span>
            現在のバージョン:{' '}
            <span className="font-semibold">{event.caution_version}</span>
          </span>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          注意事項を保存すると、バージョンが自動的にインクリメントされます。
          既存の予約者には新しい注意事項への同意が求められる場合があります。
        </p>
      </Card>

      {/* Editor */}
      <Card className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            注意事項テキスト
          </h2>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={openTemplateModal}
            >
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
              disabled={!cautionText.trim()}
            >
              <BookmarkPlus className="mr-1 h-4 w-4" />
              テンプレートとして保存
            </Button>
          </div>
        </div>
        <Textarea
          value={cautionText}
          onChange={(e) => setCautionText(e.target.value)}
          rows={12}
          placeholder="注意事項を入力してください..."
          className="font-mono text-sm"
        />
        <div className="mt-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
          >
            <Eye className="mr-1 h-4 w-4" />
            {showPreview ? 'プレビューを閉じる' : 'プレビュー'}
          </Button>
          <SaveStatus status={autoSaveStatus} />
        </div>
      </Card>

      {/* Preview */}
      {showPreview && (
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            プレビュー
          </h2>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            {cautionText ? (
              <div className="whitespace-pre-wrap text-sm text-gray-700">
                {cautionText}
              </div>
            ) : (
              <p className="text-sm italic text-gray-400">
                注意事項が入力されていません
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Template Load Modal */}
      <Modal
        isOpen={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        title="注意事項テンプレートから読み込み"
        size="lg"
      >
        {templatesLoading ? (
          <div className="flex min-h-[120px] items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : templates.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">
            テンプレートがありません
          </p>
        ) : (
          <div className="max-h-[400px] space-y-2 overflow-y-auto">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => applyTemplate(t)}
                className="w-full rounded-lg border border-gray-200 p-3 text-left transition hover:border-blue-300 hover:bg-blue-50"
              >
                <p className="font-medium text-gray-900">{t.name}</p>
                {t.description && (
                  <p className="mt-0.5 text-xs text-gray-400">{t.description}</p>
                )}
                <p className="mt-1 line-clamp-2 text-sm text-gray-500">
                  {t.caution_text}
                </p>
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
          現在の注意事項テキストをテンプレートとして保存します。
        </p>
        <Input
          label="テンプレート名"
          required
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          placeholder="例: 標準注意事項"
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
