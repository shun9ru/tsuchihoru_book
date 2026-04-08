import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  GripVertical,
  ClipboardList,
  X,
  FileText,
  BookmarkPlus,
} from 'lucide-react'
import { eventsApi, surveysApi, templatesApi } from '@/lib/api'
import {
  Button,
  Card,
  Input,
  Select,
  Checkbox,
  Badge,
  LoadingSpinner,
  Modal,
  ConfirmDialog,
  EmptyState,
} from '@/components/ui'
import { QUESTION_TYPE_LABELS } from '@/lib/constants'
import { formatDateTime } from '@/lib/utils'
import type { Event, SurveyQuestion, SurveyTemplate, SurveyTemplateQuestion, QuestionType } from '@/types'

interface QuestionFormData {
  question_text: string
  question_type: QuestionType
  is_required: boolean
  options: string[]
  parent_question_id: string | null
  condition_value: string | null
}

const EMPTY_FORM: QuestionFormData = {
  question_text: '',
  question_type: 'single_choice',
  is_required: false,
  options: ['', ''],
  parent_question_id: null,
  condition_value: null,
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

export default function SurveyEditPage() {
  const { id: eventId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [event, setEvent] = useState<Event | null>(null)
  const [questions, setQuestions] = useState<SurveyQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null)
  const [formData, setFormData] = useState<QuestionFormData>(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<SurveyQuestion | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Reorder saving
  const [reordering, setReordering] = useState(false)

  // Template states
  const [templateModalOpen, setTemplateModalOpen] = useState(false)
  const [surveyTemplates, setSurveyTemplates] = useState<SurveyTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [templateConfirmTarget, setTemplateConfirmTarget] = useState<SurveyTemplate | null>(null)
  const [applyingTemplate, setApplyingTemplate] = useState(false)
  const [saveTemplateModalOpen, setSaveTemplateModalOpen] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)

  const fetchData = useCallback(async () => {
    if (!eventId) return
    try {
      setLoading(true)
      setError(null)
      const [eventData, questionsData] = await Promise.all([
        eventsApi.getEvent(eventId),
        surveysApi.getSurveyQuestions(eventId),
      ])
      setEvent(eventData)
      setQuestions(questionsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : '読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // --- Form handling ---

  const openAddModal = () => {
    setEditingQuestionId(null)
    setFormData(EMPTY_FORM)
    setFormErrors({})
    setIsModalOpen(true)
  }

  const openEditModal = (question: SurveyQuestion) => {
    setEditingQuestionId(question.id)
    const options = Array.isArray(question.options_json)
      ? (question.options_json as string[])
      : ['', '']
    setFormData({
      question_text: question.question_text,
      question_type: question.question_type as QuestionType,
      is_required: question.is_required,
      options: options.length >= 2 ? options : [...options, ...Array(2 - options.length).fill('')],
      parent_question_id: question.parent_question_id ?? null,
      condition_value: question.condition_value ?? null,
    })
    setFormErrors({})
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingQuestionId(null)
    setFormData(EMPTY_FORM)
    setFormErrors({})
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!formData.question_text.trim()) {
      errors.question_text = '設問テキストを入力してください'
    }

    if (formData.question_type !== 'free_text') {
      const validOptions = formData.options.filter((o) => o.trim() !== '')
      if (validOptions.length < 2) {
        errors.options = '選択肢は最低2つ必要です'
      }
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async () => {
    if (!eventId || !validateForm()) return

    try {
      setSubmitting(true)
      setError(null)

      const optionsJson =
        formData.question_type !== 'free_text'
          ? formData.options.filter((o) => o.trim() !== '')
          : null

      const conditionData = {
        parent_question_id: formData.parent_question_id || null,
        condition_value: formData.parent_question_id ? (formData.condition_value || null) : null,
      }

      if (editingQuestionId) {
        // Update
        await surveysApi.updateSurveyQuestion(editingQuestionId, {
          question_text: formData.question_text,
          question_type: formData.question_type,
          is_required: formData.is_required,
          options_json: optionsJson,
          ...conditionData,
        })
      } else {
        // Create
        const maxOrder = questions.reduce(
          (max, q) => Math.max(max, q.sort_order),
          0
        )
        await surveysApi.createSurveyQuestion({
          event_id: eventId,
          question_text: formData.question_text,
          question_type: formData.question_type,
          is_required: formData.is_required,
          sort_order: maxOrder + 1,
          options_json: optionsJson,
          ...conditionData,
        })
      }

      closeModal()
      // Refresh questions
      const updated = await surveysApi.getSurveyQuestions(eventId)
      setQuestions(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  // --- Delete ---

  const handleDelete = async () => {
    if (!deleteTarget || !eventId) return
    try {
      setDeleting(true)
      setError(null)
      await surveysApi.deleteSurveyQuestion(deleteTarget.id)
      setDeleteTarget(null)
      const updated = await surveysApi.getSurveyQuestions(eventId)
      setQuestions(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : '削除に失敗しました')
    } finally {
      setDeleting(false)
    }
  }

  // --- Reorder ---

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    if (!eventId) return
    const newQuestions = [...questions]
    const targetIndex = direction === 'up' ? index - 1 : index + 1

    if (targetIndex < 0 || targetIndex >= newQuestions.length) return

    // Swap
    ;[newQuestions[index], newQuestions[targetIndex]] = [
      newQuestions[targetIndex],
      newQuestions[index],
    ]

    // Update sort_order
    const reordered = newQuestions.map((q, i) => ({
      ...q,
      sort_order: i + 1,
    }))

    setQuestions(reordered)

    try {
      setReordering(true)
      await surveysApi.reorderSurveyQuestions(
        reordered.map((q) => ({ id: q.id, sort_order: q.sort_order }))
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : '並び替えに失敗しました')
      // Revert on error
      const reverted = await surveysApi.getSurveyQuestions(eventId)
      setQuestions(reverted)
    } finally {
      setReordering(false)
    }
  }

  // --- Option editing ---

  const updateOption = (index: number, value: string) => {
    const newOptions = [...formData.options]
    newOptions[index] = value
    setFormData({ ...formData, options: newOptions })
  }

  const addOption = () => {
    setFormData({ ...formData, options: [...formData.options, ''] })
  }

  const removeOption = (index: number) => {
    if (formData.options.length <= 2) return
    const newOptions = formData.options.filter((_, i) => i !== index)
    setFormData({ ...formData, options: newOptions })
  }

  // --- Template functions ---

  const openTemplateModal = async () => {
    setTemplateModalOpen(true)
    try {
      setTemplatesLoading(true)
      const data = await templatesApi.getSurveyTemplates()
      setSurveyTemplates(data)
    } catch {
      setError('テンプレートの読み込みに失敗しました')
    } finally {
      setTemplatesLoading(false)
    }
  }

  const handleApplyTemplate = async () => {
    if (!templateConfirmTarget || !eventId) return
    try {
      setApplyingTemplate(true)
      setError(null)
      // Delete existing questions first
      for (const q of questions) {
        await surveysApi.deleteSurveyQuestion(q.id)
      }
      await templatesApi.applySurveyTemplate(templateConfirmTarget.id, eventId)
      const updated = await surveysApi.getSurveyQuestions(eventId)
      setQuestions(updated)
      setTemplateConfirmTarget(null)
      setTemplateModalOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'テンプレートの適用に失敗しました')
    } finally {
      setApplyingTemplate(false)
    }
  }

  const handleSaveAsTemplate = async () => {
    if (!templateName.trim() || questions.length === 0) return
    try {
      setSavingTemplate(true)
      setError(null)
      const questionsJson: SurveyTemplateQuestion[] = questions.map((q) => ({
        question_text: q.question_text,
        question_type: q.question_type as QuestionType,
        is_required: q.is_required,
        options: Array.isArray(q.options_json) ? (q.options_json as string[]) : undefined,
      }))
      await templatesApi.createSurveyTemplate({
        name: templateName,
        questions_json: JSON.parse(JSON.stringify(questionsJson)),
      })
      setSaveTemplateModalOpen(false)
      setTemplateName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'テンプレートの保存に失敗しました')
    } finally {
      setSavingTemplate(false)
    }
  }

  // --- Render ---

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              アンケート設問の編集
            </h1>
            <p className="mt-1 text-sm text-gray-500">{event.title}</p>
          </div>
          <div className="flex gap-2">
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
              disabled={questions.length === 0}
            >
              <BookmarkPlus className="mr-1 h-4 w-4" />
              テンプレートとして保存
            </Button>
            <Button onClick={openAddModal}>
              <Plus className="mr-1 h-4 w-4" />
              設問を追加
            </Button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Questions List */}
      {questions.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="アンケート設問がありません"
          description="「設問を追加」ボタンから設問を作成してください"
          action={
            <Button onClick={openAddModal}>
              <Plus className="mr-1 h-4 w-4" />
              設問を追加
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {questions.map((question, index) => (
            <Card key={question.id} className="relative">
              <div className="flex items-start gap-3">
                {/* Drag handle / order controls */}
                <div className="flex flex-col items-center gap-1 pt-1">
                  <GripVertical className="h-4 w-4 text-gray-300" />
                  <button
                    onClick={() => handleMove(index, 'up')}
                    disabled={index === 0 || reordering}
                    className="rounded p-0.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30"
                    title="上へ移動"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleMove(index, 'down')}
                    disabled={index === questions.length - 1 || reordering}
                    className="rounded p-0.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30"
                    title="下へ移動"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>

                {/* Question content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-400">
                      Q{index + 1}
                    </span>
                    <Badge variant={getTypeBadgeVariant(question.question_type)}>
                      {QUESTION_TYPE_LABELS[question.question_type] ??
                        question.question_type}
                    </Badge>
                    {question.is_required && (
                      <Badge variant="danger">必須</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {question.question_text}
                  </p>
                  {question.parent_question_id && (() => {
                    const parent = questions.find(q => q.id === question.parent_question_id)
                    return parent ? (
                      <p className="mt-1 text-xs text-orange-600">
                        条件: 「{parent.question_text}」で「{question.condition_value}」を選択時に表示
                      </p>
                    ) : null
                  })()}
                  {question.question_type !== 'free_text' &&
                    Array.isArray(question.options_json) && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(question.options_json as string[]).map(
                          (opt, optIndex) => (
                            <span
                              key={optIndex}
                              className="inline-block rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                            >
                              {opt}
                            </span>
                          )
                        )}
                      </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(question)}
                    className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-blue-600"
                    title="編集"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(question)}
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
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingQuestionId ? '設問を編集' : '設問を追加'}
        size="lg"
      >
        <div className="space-y-4">
          {/* Question text */}
          <Input
            label="設問テキスト"
            required
            value={formData.question_text}
            onChange={(e) =>
              setFormData({ ...formData, question_text: e.target.value })
            }
            error={formErrors.question_text}
            placeholder="例: どのようにしてこのイベントを知りましたか？"
          />

          {/* Question type */}
          <Select
            label="回答形式"
            required
            options={QUESTION_TYPE_OPTIONS}
            value={formData.question_type}
            onChange={(e) =>
              setFormData({
                ...formData,
                question_type: e.target.value as QuestionType,
                options:
                  e.target.value === 'free_text'
                    ? formData.options
                    : formData.options.length < 2
                      ? ['', '']
                      : formData.options,
              })
            }
          />

          {/* Required */}
          <Checkbox
            label="必須回答にする"
            checked={formData.is_required}
            onChange={(e) =>
              setFormData({ ...formData, is_required: e.target.checked })
            }
          />

          {/* Condition branching */}
          {(() => {
            // 条件分岐の親候補: 選択式の既存設問（自分自身を除く）
            const parentCandidates = questions.filter(
              q => q.id !== editingQuestionId && (q.question_type === 'single_choice' || q.question_type === 'multiple_choice')
            )
            if (parentCandidates.length === 0) return null

            const selectedParent = parentCandidates.find(q => q.id === formData.parent_question_id)
            const parentOptions = selectedParent && Array.isArray(selectedParent.options_json)
              ? (selectedParent.options_json as string[])
              : []

            return (
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 space-y-3">
                <label className="text-sm font-medium text-orange-800">条件分岐（任意）</label>
                <Select
                  label="表示条件の親設問"
                  options={[
                    { value: '', label: '条件なし（常に表示）' },
                    ...parentCandidates.map((q) => ({
                      value: q.id,
                      label: `Q${questions.indexOf(q) + 1}: ${q.question_text.slice(0, 30)}${q.question_text.length > 30 ? '…' : ''}`,
                    })),
                  ]}
                  value={formData.parent_question_id ?? ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    parent_question_id: e.target.value || null,
                    condition_value: null,
                  })}
                />
                {formData.parent_question_id && parentOptions.length > 0 && (
                  <Select
                    label="この回答が選択された場合に表示"
                    options={[
                      { value: '', label: '選択してください' },
                      ...parentOptions.map(opt => ({ value: opt, label: opt })),
                    ]}
                    value={formData.condition_value ?? ''}
                    onChange={(e) => setFormData({ ...formData, condition_value: e.target.value || null })}
                  />
                )}
              </div>
            )
          })()}

          {/* Options editor (only for choice types) */}
          {formData.question_type !== 'free_text' && (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                選択肢 <span className="text-red-500">*</span>
              </label>
              {formErrors.options && (
                <p className="mb-2 text-sm text-red-600">
                  {formErrors.options}
                </p>
              )}
              <div className="space-y-2">
                {formData.options.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="w-6 text-center text-xs text-gray-400">
                      {index + 1}
                    </span>
                    <Input
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                      placeholder={`選択肢 ${index + 1}`}
                      className="flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => removeOption(index)}
                      disabled={formData.options.length <= 2}
                      className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-red-600 disabled:opacity-30"
                      title="選択肢を削除"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={addOption}
              >
                <Plus className="mr-1 h-3 w-3" />
                選択肢を追加
              </Button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3 border-t border-gray-200 pt-4">
          <Button variant="secondary" onClick={closeModal}>
            キャンセル
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            {editingQuestionId ? '更新' : '追加'}
          </Button>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="設問の削除"
        message={`「${deleteTarget?.question_text ?? ''}」を削除してもよろしいですか？この操作は取り消せません。`}
        confirmLabel={deleting ? '削除中...' : '削除'}
        variant="danger"
      />

      {/* Template Load Modal */}
      <Modal
        isOpen={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        title="アンケートテンプレートから読み込み"
        size="lg"
      >
        {templatesLoading ? (
          <div className="flex min-h-[120px] items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : surveyTemplates.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">
            テンプレートがありません
          </p>
        ) : (
          <div className="max-h-[400px] space-y-2 overflow-y-auto">
            {surveyTemplates.map((t) => {
              const tQuestions = t.questions_json as unknown as SurveyTemplateQuestion[]
              const count = Array.isArray(tQuestions) ? tQuestions.length : 0
              return (
                <button
                  key={t.id}
                  onClick={() => setTemplateConfirmTarget(t)}
                  className="w-full rounded-lg border border-gray-200 p-3 text-left transition hover:border-blue-300 hover:bg-blue-50"
                >
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">{t.name}</p>
                    <Badge variant="default">{count}問</Badge>
                  </div>
                  {t.description && (
                    <p className="mt-0.5 text-xs text-gray-400">{t.description}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-400">
                    {formatDateTime(t.created_at)}
                  </p>
                </button>
              )
            })}
          </div>
        )}
        <div className="mt-4 flex justify-end">
          <Button variant="secondary" onClick={() => setTemplateModalOpen(false)}>
            閉じる
          </Button>
        </div>
      </Modal>

      {/* Template Apply Confirmation */}
      <ConfirmDialog
        isOpen={!!templateConfirmTarget}
        onClose={() => setTemplateConfirmTarget(null)}
        onConfirm={handleApplyTemplate}
        title="テンプレートの適用"
        message="現在の設問を置き換えますか？既存の設問はすべて削除され、テンプレートの設問に置き換えられます。"
        confirmLabel={applyingTemplate ? '適用中...' : '置き換える'}
        variant="danger"
      />

      {/* Save as Template Modal */}
      <Modal
        isOpen={saveTemplateModalOpen}
        onClose={() => setSaveTemplateModalOpen(false)}
        title="テンプレートとして保存"
        size="sm"
      >
        <p className="mb-4 text-sm text-gray-600">
          現在の設問（{questions.length}問）をテンプレートとして保存します。
        </p>
        <Input
          label="テンプレート名"
          required
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          placeholder="例: 標準アンケート"
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
