import { useState, useEffect, useCallback } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  Mail,
  AlertTriangle,
  ClipboardList,
  X,
} from 'lucide-react'
import { templatesApi } from '@/lib/api'
import {
  Button,
  Card,
  Input,
  Textarea,
  Select,
  Modal,
  ConfirmDialog,
  EmptyState,
  LoadingSpinner,
  Badge,
} from '@/components/ui'
import { QUESTION_TYPE_LABELS } from '@/lib/constants'
import { formatDateTime } from '@/lib/utils'
import type {
  EmailTemplate,
  CautionTemplate,
  SurveyTemplate,
  SurveyTemplateQuestion,
  QuestionType,
} from '@/types'

// ========================================
// Tab types
// ========================================

type TabKey = 'email' | 'caution' | 'survey'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'email', label: 'メールテンプレート' },
  { key: 'caution', label: '注意事項テンプレート' },
  { key: 'survey', label: 'アンケートテンプレート' },
]

// ========================================
// Question form types (for survey tab)
// ========================================

interface QuestionFormItem {
  question_text: string
  question_type: QuestionType
  is_required: boolean
  options: string[]
}

const QUESTION_TYPE_OPTIONS = [
  { value: 'single_choice', label: '単一選択' },
  { value: 'multiple_choice', label: '複数選択' },
  { value: 'free_text', label: '自由記述' },
]

function getTypeBadgeVariant(type: string): 'info' | 'warning' | 'default' {
  switch (type) {
    case 'single_choice':
      return 'info'
    case 'multiple_choice':
      return 'warning'
    default:
      return 'default'
  }
}

// ========================================
// Main Component
// ========================================

export default function TemplatesPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('email')

  // Email templates
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([])
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailLoaded, setEmailLoaded] = useState(false)

  // Caution templates
  const [cautionTemplates, setCautionTemplates] = useState<CautionTemplate[]>([])
  const [cautionLoading, setCautionLoading] = useState(false)
  const [cautionLoaded, setCautionLoaded] = useState(false)

  // Survey templates
  const [surveyTemplates, setSurveyTemplates] = useState<SurveyTemplate[]>([])
  const [surveyLoading, setSurveyLoading] = useState(false)
  const [surveyLoaded, setSurveyLoaded] = useState(false)

  // Common
  const [error, setError] = useState<string | null>(null)

  // Email modal
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [editingEmailId, setEditingEmailId] = useState<string | null>(null)
  const [emailForm, setEmailForm] = useState({ name: '', subject: '', body: '', description: '' })
  const [emailSubmitting, setEmailSubmitting] = useState(false)

  // Caution modal
  const [cautionModalOpen, setCautionModalOpen] = useState(false)
  const [editingCautionId, setEditingCautionId] = useState<string | null>(null)
  const [cautionForm, setCautionForm] = useState({ name: '', caution_text: '', description: '' })
  const [cautionSubmitting, setCautionSubmitting] = useState(false)

  // Survey modal
  const [surveyModalOpen, setSurveyModalOpen] = useState(false)
  const [editingSurveyId, setEditingSurveyId] = useState<string | null>(null)
  const [surveyForm, setSurveyForm] = useState({ name: '', description: '' })
  const [surveyQuestions, setSurveyQuestions] = useState<QuestionFormItem[]>([])
  const [surveySubmitting, setSurveySubmitting] = useState(false)

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<{ type: TabKey; id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ========================================
  // Fetch functions
  // ========================================

  const fetchEmailTemplates = useCallback(async () => {
    try {
      setEmailLoading(true)
      setError(null)
      const data = await templatesApi.getEmailTemplates()
      setEmailTemplates(data)
      setEmailLoaded(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '読み込みに失敗しました')
    } finally {
      setEmailLoading(false)
    }
  }, [])

  const fetchCautionTemplates = useCallback(async () => {
    try {
      setCautionLoading(true)
      setError(null)
      const data = await templatesApi.getCautionTemplates()
      setCautionTemplates(data)
      setCautionLoaded(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '読み込みに失敗しました')
    } finally {
      setCautionLoading(false)
    }
  }, [])

  const fetchSurveyTemplates = useCallback(async () => {
    try {
      setSurveyLoading(true)
      setError(null)
      const data = await templatesApi.getSurveyTemplates()
      setSurveyTemplates(data)
      setSurveyLoaded(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '読み込みに失敗しました')
    } finally {
      setSurveyLoading(false)
    }
  }, [])

  // Fetch data on tab change (lazy loading)
  useEffect(() => {
    if (activeTab === 'email' && !emailLoaded) fetchEmailTemplates()
    if (activeTab === 'caution' && !cautionLoaded) fetchCautionTemplates()
    if (activeTab === 'survey' && !surveyLoaded) fetchSurveyTemplates()
  }, [activeTab, emailLoaded, cautionLoaded, surveyLoaded, fetchEmailTemplates, fetchCautionTemplates, fetchSurveyTemplates])

  // ========================================
  // Email template CRUD
  // ========================================

  const openEmailCreate = () => {
    setEditingEmailId(null)
    setEmailForm({ name: '', subject: '', body: '', description: '' })
    setEmailModalOpen(true)
  }

  const openEmailEdit = (t: EmailTemplate) => {
    setEditingEmailId(t.id)
    setEmailForm({
      name: t.name,
      subject: t.subject,
      body: t.body,
      description: t.description ?? '',
    })
    setEmailModalOpen(true)
  }

  const handleEmailSubmit = async () => {
    if (!emailForm.name.trim() || !emailForm.subject.trim() || !emailForm.body.trim()) return
    try {
      setEmailSubmitting(true)
      setError(null)
      if (editingEmailId) {
        await templatesApi.updateEmailTemplate(editingEmailId, {
          name: emailForm.name,
          subject: emailForm.subject,
          body: emailForm.body,
          description: emailForm.description || null,
        })
      } else {
        await templatesApi.createEmailTemplate({
          name: emailForm.name,
          subject: emailForm.subject,
          body: emailForm.body,
          description: emailForm.description || null,
        })
      }
      setEmailModalOpen(false)
      await fetchEmailTemplates()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setEmailSubmitting(false)
    }
  }

  // ========================================
  // Caution template CRUD
  // ========================================

  const openCautionCreate = () => {
    setEditingCautionId(null)
    setCautionForm({ name: '', caution_text: '', description: '' })
    setCautionModalOpen(true)
  }

  const openCautionEdit = (t: CautionTemplate) => {
    setEditingCautionId(t.id)
    setCautionForm({
      name: t.name,
      caution_text: t.caution_text,
      description: t.description ?? '',
    })
    setCautionModalOpen(true)
  }

  const handleCautionSubmit = async () => {
    if (!cautionForm.name.trim() || !cautionForm.caution_text.trim()) return
    try {
      setCautionSubmitting(true)
      setError(null)
      if (editingCautionId) {
        await templatesApi.updateCautionTemplate(editingCautionId, {
          name: cautionForm.name,
          caution_text: cautionForm.caution_text,
          description: cautionForm.description || null,
        })
      } else {
        await templatesApi.createCautionTemplate({
          name: cautionForm.name,
          caution_text: cautionForm.caution_text,
          description: cautionForm.description || null,
        })
      }
      setCautionModalOpen(false)
      await fetchCautionTemplates()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setCautionSubmitting(false)
    }
  }

  // ========================================
  // Survey template CRUD
  // ========================================

  const openSurveyCreate = () => {
    setEditingSurveyId(null)
    setSurveyForm({ name: '', description: '' })
    setSurveyQuestions([
      { question_text: '', question_type: 'single_choice', is_required: false, options: ['', ''] },
    ])
    setSurveyModalOpen(true)
  }

  const openSurveyEdit = (t: SurveyTemplate) => {
    setEditingSurveyId(t.id)
    setSurveyForm({ name: t.name, description: t.description ?? '' })
    const questions = t.questions_json as unknown as SurveyTemplateQuestion[]
    if (Array.isArray(questions) && questions.length > 0) {
      setSurveyQuestions(
        questions.map((q) => ({
          question_text: q.question_text,
          question_type: q.question_type,
          is_required: q.is_required,
          options: q.options ?? ['', ''],
        }))
      )
    } else {
      setSurveyQuestions([
        { question_text: '', question_type: 'single_choice', is_required: false, options: ['', ''] },
      ])
    }
    setSurveyModalOpen(true)
  }

  const handleSurveySubmit = async () => {
    if (!surveyForm.name.trim()) return
    const validQuestions = surveyQuestions.filter((q) => q.question_text.trim())
    if (validQuestions.length === 0) return

    try {
      setSurveySubmitting(true)
      setError(null)

      const questionsJson: SurveyTemplateQuestion[] = validQuestions.map((q) => ({
        question_text: q.question_text,
        question_type: q.question_type,
        is_required: q.is_required,
        options: q.question_type !== 'free_text' ? q.options.filter((o) => o.trim()) : undefined,
      }))

      if (editingSurveyId) {
        await templatesApi.updateSurveyTemplate(editingSurveyId, {
          name: surveyForm.name,
          description: surveyForm.description || null,
          questions_json: JSON.parse(JSON.stringify(questionsJson)),
        })
      } else {
        await templatesApi.createSurveyTemplate({
          name: surveyForm.name,
          description: surveyForm.description || null,
          questions_json: JSON.parse(JSON.stringify(questionsJson)),
        })
      }
      setSurveyModalOpen(false)
      await fetchSurveyTemplates()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setSurveySubmitting(false)
    }
  }

  // Survey question editors
  const updateSurveyQuestion = (index: number, updates: Partial<QuestionFormItem>) => {
    setSurveyQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, ...updates } : q))
    )
  }

  const addSurveyQuestion = () => {
    setSurveyQuestions((prev) => [
      ...prev,
      { question_text: '', question_type: 'single_choice', is_required: false, options: ['', ''] },
    ])
  }

  const removeSurveyQuestion = (index: number) => {
    setSurveyQuestions((prev) => prev.filter((_, i) => i !== index))
  }

  const updateQuestionOption = (qIndex: number, oIndex: number, value: string) => {
    setSurveyQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex) return q
        const newOptions = [...q.options]
        newOptions[oIndex] = value
        return { ...q, options: newOptions }
      })
    )
  }

  const addQuestionOption = (qIndex: number) => {
    setSurveyQuestions((prev) =>
      prev.map((q, i) => (i === qIndex ? { ...q, options: [...q.options, ''] } : q))
    )
  }

  const removeQuestionOption = (qIndex: number, oIndex: number) => {
    setSurveyQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex || q.options.length <= 2) return q
        return { ...q, options: q.options.filter((_, j) => j !== oIndex) }
      })
    )
  }

  // ========================================
  // Delete
  // ========================================

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      setDeleting(true)
      setError(null)
      if (deleteTarget.type === 'email') {
        await templatesApi.deleteEmailTemplate(deleteTarget.id)
        await fetchEmailTemplates()
      } else if (deleteTarget.type === 'caution') {
        await templatesApi.deleteCautionTemplate(deleteTarget.id)
        await fetchCautionTemplates()
      } else {
        await templatesApi.deleteSurveyTemplate(deleteTarget.id)
        await fetchSurveyTemplates()
      }
      setDeleteTarget(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '削除に失敗しました')
    } finally {
      setDeleting(false)
    }
  }

  // ========================================
  // Render helpers
  // ========================================

  function truncate(text: string, maxLen: number): string {
    return text.length > maxLen ? text.slice(0, maxLen) + '...' : text
  }

  const renderEmailTab = () => {
    if (emailLoading) {
      return (
        <div className="flex min-h-[200px] items-center justify-center">
          <LoadingSpinner />
        </div>
      )
    }

    if (emailTemplates.length === 0) {
      return (
        <EmptyState
          icon={Mail}
          title="メールテンプレートがありません"
          description="「新規作成」ボタンからテンプレートを作成してください"
          action={
            <Button onClick={openEmailCreate}>
              <Plus className="mr-1 h-4 w-4" />
              新規作成
            </Button>
          }
        />
      )
    }

    return (
      <div className="space-y-3">
        {emailTemplates.map((t) => (
          <Card key={t.id}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-gray-900">{t.name}</h3>
                <p className="mt-1 text-sm text-gray-500">
                  件名: {t.subject}
                </p>
                {t.description && (
                  <p className="mt-1 text-xs text-gray-400">
                    {truncate(t.description, 80)}
                  </p>
                )}
                <p className="mt-2 text-xs text-gray-400">
                  作成日: {formatDateTime(t.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => openEmailEdit(t)}
                  className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-blue-600"
                  title="編集"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setDeleteTarget({ type: 'email', id: t.id, name: t.name })}
                  className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-red-600"
                  title="削除"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    )
  }

  const renderCautionTab = () => {
    if (cautionLoading) {
      return (
        <div className="flex min-h-[200px] items-center justify-center">
          <LoadingSpinner />
        </div>
      )
    }

    if (cautionTemplates.length === 0) {
      return (
        <EmptyState
          icon={AlertTriangle}
          title="注意事項テンプレートがありません"
          description="「新規作成」ボタンからテンプレートを作成してください"
          action={
            <Button onClick={openCautionCreate}>
              <Plus className="mr-1 h-4 w-4" />
              新規作成
            </Button>
          }
        />
      )
    }

    return (
      <div className="space-y-3">
        {cautionTemplates.map((t) => (
          <Card key={t.id}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-gray-900">{t.name}</h3>
                {t.description && (
                  <p className="mt-1 text-xs text-gray-400">
                    {truncate(t.description, 80)}
                  </p>
                )}
                <p className="mt-1 text-sm text-gray-500">
                  {truncate(t.caution_text, 100)}
                </p>
                <p className="mt-2 text-xs text-gray-400">
                  作成日: {formatDateTime(t.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => openCautionEdit(t)}
                  className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-blue-600"
                  title="編集"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setDeleteTarget({ type: 'caution', id: t.id, name: t.name })}
                  className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-red-600"
                  title="削除"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    )
  }

  const renderSurveyTab = () => {
    if (surveyLoading) {
      return (
        <div className="flex min-h-[200px] items-center justify-center">
          <LoadingSpinner />
        </div>
      )
    }

    if (surveyTemplates.length === 0) {
      return (
        <EmptyState
          icon={ClipboardList}
          title="アンケートテンプレートがありません"
          description="「新規作成」ボタンからテンプレートを作成してください"
          action={
            <Button onClick={openSurveyCreate}>
              <Plus className="mr-1 h-4 w-4" />
              新規作成
            </Button>
          }
        />
      )
    }

    return (
      <div className="space-y-3">
        {surveyTemplates.map((t) => {
          const questions = t.questions_json as unknown as SurveyTemplateQuestion[]
          const questionCount = Array.isArray(questions) ? questions.length : 0
          return (
            <Card key={t.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{t.name}</h3>
                    <Badge variant="default">{questionCount}問</Badge>
                  </div>
                  {t.description && (
                    <p className="mt-1 text-xs text-gray-400">
                      {truncate(t.description, 80)}
                    </p>
                  )}
                  {Array.isArray(questions) && questions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {questions.slice(0, 3).map((q, i) => (
                        <Badge key={i} variant={getTypeBadgeVariant(q.question_type)}>
                          {QUESTION_TYPE_LABELS[q.question_type] ?? q.question_type}
                        </Badge>
                      ))}
                      {questions.length > 3 && (
                        <span className="text-xs text-gray-400">
                          +{questions.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                  <p className="mt-2 text-xs text-gray-400">
                    作成日: {formatDateTime(t.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openSurveyEdit(t)}
                    className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-blue-600"
                    title="編集"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget({ type: 'survey', id: t.id, name: t.name })}
                    className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-red-600"
                    title="削除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">テンプレート管理</h1>
        <p className="mt-1 text-sm text-gray-500">
          メール・注意事項・アンケートのテンプレートを管理します
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-medium transition ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Create button */}
      <div className="mb-4 flex justify-end">
        <Button
          onClick={
            activeTab === 'email'
              ? openEmailCreate
              : activeTab === 'caution'
                ? openCautionCreate
                : openSurveyCreate
          }
        >
          <Plus className="mr-1 h-4 w-4" />
          新規作成
        </Button>
      </div>

      {/* Tab content */}
      {activeTab === 'email' && renderEmailTab()}
      {activeTab === 'caution' && renderCautionTab()}
      {activeTab === 'survey' && renderSurveyTab()}

      {/* ========================================
          Email Template Modal
          ======================================== */}
      <Modal
        isOpen={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        title={editingEmailId ? 'メールテンプレートを編集' : 'メールテンプレートを作成'}
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="テンプレート名"
            required
            value={emailForm.name}
            onChange={(e) => setEmailForm({ ...emailForm, name: e.target.value })}
            placeholder="例: 予約確認メール"
          />
          <Input
            label="件名"
            required
            value={emailForm.subject}
            onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
            placeholder="例: 【{{event_title}}】ご予約ありがとうございます"
          />
          <Textarea
            label="本文"
            required
            rows={8}
            value={emailForm.body}
            onChange={(e) => setEmailForm({ ...emailForm, body: e.target.value })}
            placeholder="メール本文を入力してください..."
          />
          <Input
            label="説明"
            value={emailForm.description}
            onChange={(e) => setEmailForm({ ...emailForm, description: e.target.value })}
            placeholder="テンプレートの説明（任意）"
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
                <span>参加者名</span>
              </div>
              <div className="flex gap-2">
                <code className="rounded bg-gray-200 px-1.5 py-0.5 font-mono text-blue-700">
                  {'{{event_title}}'}
                </code>
                <span>イベント名</span>
              </div>
              <div className="flex gap-2">
                <code className="rounded bg-gray-200 px-1.5 py-0.5 font-mono text-blue-700">
                  {'{{event_date}}'}
                </code>
                <span>イベント開催日</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3 border-t border-gray-200 pt-4">
          <Button variant="secondary" onClick={() => setEmailModalOpen(false)}>
            キャンセル
          </Button>
          <Button onClick={handleEmailSubmit} loading={emailSubmitting}>
            {editingEmailId ? '更新' : '作成'}
          </Button>
        </div>
      </Modal>

      {/* ========================================
          Caution Template Modal
          ======================================== */}
      <Modal
        isOpen={cautionModalOpen}
        onClose={() => setCautionModalOpen(false)}
        title={editingCautionId ? '注意事項テンプレートを編集' : '注意事項テンプレートを作成'}
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="テンプレート名"
            required
            value={cautionForm.name}
            onChange={(e) => setCautionForm({ ...cautionForm, name: e.target.value })}
            placeholder="例: 標準注意事項"
          />
          <Textarea
            label="注意事項テキスト"
            required
            rows={10}
            value={cautionForm.caution_text}
            onChange={(e) => setCautionForm({ ...cautionForm, caution_text: e.target.value })}
            placeholder="注意事項テキストを入力してください..."
            className="font-mono text-sm"
          />
          <Input
            label="説明"
            value={cautionForm.description}
            onChange={(e) => setCautionForm({ ...cautionForm, description: e.target.value })}
            placeholder="テンプレートの説明（任意）"
          />
        </div>

        <div className="mt-6 flex justify-end gap-3 border-t border-gray-200 pt-4">
          <Button variant="secondary" onClick={() => setCautionModalOpen(false)}>
            キャンセル
          </Button>
          <Button onClick={handleCautionSubmit} loading={cautionSubmitting}>
            {editingCautionId ? '更新' : '作成'}
          </Button>
        </div>
      </Modal>

      {/* ========================================
          Survey Template Modal
          ======================================== */}
      <Modal
        isOpen={surveyModalOpen}
        onClose={() => setSurveyModalOpen(false)}
        title={editingSurveyId ? 'アンケートテンプレートを編集' : 'アンケートテンプレートを作成'}
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="テンプレート名"
            required
            value={surveyForm.name}
            onChange={(e) => setSurveyForm({ ...surveyForm, name: e.target.value })}
            placeholder="例: 標準アンケート"
          />
          <Input
            label="説明"
            value={surveyForm.description}
            onChange={(e) => setSurveyForm({ ...surveyForm, description: e.target.value })}
            placeholder="テンプレートの説明（任意）"
          />

          {/* Questions editor */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              設問 <span className="text-red-500">*</span>
            </label>
            <div className="space-y-4">
              {surveyQuestions.map((q, qIndex) => (
                <div
                  key={qIndex}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-500">
                        Q{qIndex + 1}
                      </span>
                      <Badge variant={getTypeBadgeVariant(q.question_type)}>
                        {QUESTION_TYPE_LABELS[q.question_type] ?? q.question_type}
                      </Badge>
                      {q.is_required && <Badge variant="danger">必須</Badge>}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSurveyQuestion(qIndex)}
                      disabled={surveyQuestions.length <= 1}
                      className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-200 hover:text-red-600 disabled:opacity-30"
                      title="設問を削除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <Input
                      value={q.question_text}
                      onChange={(e) =>
                        updateSurveyQuestion(qIndex, { question_text: e.target.value })
                      }
                      placeholder="設問テキストを入力"
                    />

                    <div className="flex items-center gap-4">
                      <Select
                        options={QUESTION_TYPE_OPTIONS}
                        value={q.question_type}
                        onChange={(e) =>
                          updateSurveyQuestion(qIndex, {
                            question_type: e.target.value as QuestionType,
                            options:
                              e.target.value === 'free_text'
                                ? q.options
                                : q.options.length < 2
                                  ? ['', '']
                                  : q.options,
                          })
                        }
                        className="w-40"
                      />
                      <label className="flex items-center gap-1.5 text-sm text-gray-600">
                        <input
                          type="checkbox"
                          checked={q.is_required}
                          onChange={(e) =>
                            updateSurveyQuestion(qIndex, { is_required: e.target.checked })
                          }
                          className="rounded border-gray-300"
                        />
                        必須
                      </label>
                    </div>

                    {/* Options editor for choice types */}
                    {q.question_type !== 'free_text' && (
                      <div>
                        <p className="mb-1 text-xs text-gray-500">選択肢</p>
                        <div className="space-y-1.5">
                          {q.options.map((opt, oIndex) => (
                            <div key={oIndex} className="flex items-center gap-2">
                              <span className="w-5 text-center text-xs text-gray-400">
                                {oIndex + 1}
                              </span>
                              <Input
                                value={opt}
                                onChange={(e) =>
                                  updateQuestionOption(qIndex, oIndex, e.target.value)
                                }
                                placeholder={`選択肢 ${oIndex + 1}`}
                                className="flex-1"
                              />
                              <button
                                type="button"
                                onClick={() => removeQuestionOption(qIndex, oIndex)}
                                disabled={q.options.length <= 2}
                                className="rounded p-1 text-gray-400 transition hover:bg-gray-200 hover:text-red-600 disabled:opacity-30"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => addQuestionOption(qIndex)}
                          className="mt-1.5 text-xs text-blue-600 hover:text-blue-800"
                        >
                          + 選択肢を追加
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="mt-3"
              onClick={addSurveyQuestion}
            >
              <Plus className="mr-1 h-3 w-3" />
              設問を追加
            </Button>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3 border-t border-gray-200 pt-4">
          <Button variant="secondary" onClick={() => setSurveyModalOpen(false)}>
            キャンセル
          </Button>
          <Button onClick={handleSurveySubmit} loading={surveySubmitting}>
            {editingSurveyId ? '更新' : '作成'}
          </Button>
        </div>
      </Modal>

      {/* ========================================
          Delete Confirmation
          ======================================== */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="テンプレートの削除"
        message={`「${deleteTarget?.name ?? ''}」を削除してもよろしいですか？この操作は取り消せません。`}
        confirmLabel={deleting ? '削除中...' : '削除'}
        variant="danger"
      />
    </div>
  )
}
