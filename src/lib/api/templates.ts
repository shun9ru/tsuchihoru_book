import { supabase } from '@/lib/supabase'
import type {
  EmailTemplate,
  EmailTemplateInsert,
  EmailTemplateUpdate,
  CautionTemplate,
  CautionTemplateInsert,
  CautionTemplateUpdate,
  SurveyTemplate,
  SurveyTemplateInsert,
  SurveyTemplateUpdate,
  SurveyTemplateQuestion,
  SurveyQuestion,
} from '@/types'

// ========================================
// メールテンプレート
// ========================================

/** メールテンプレート一覧取得 */
export async function getEmailTemplates(): Promise<EmailTemplate[]> {
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`メールテンプレート一覧の取得に失敗しました: ${error.message}`)
  }

  return data
}

/** メールテンプレート取得 */
export async function getEmailTemplate(id: string): Promise<EmailTemplate> {
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    throw new Error(`メールテンプレートの取得に失敗しました: ${error.message}`)
  }

  return data
}

/** メールテンプレート作成 */
export async function createEmailTemplate(
  data: EmailTemplateInsert
): Promise<EmailTemplate> {
  const { data: template, error } = await supabase
    .from('email_templates')
    .insert(data)
    .select()
    .single()

  if (error) {
    throw new Error(`メールテンプレートの作成に失敗しました: ${error.message}`)
  }

  return template
}

/** メールテンプレート更新 */
export async function updateEmailTemplate(
  id: string,
  data: EmailTemplateUpdate
): Promise<EmailTemplate> {
  const { data: template, error } = await supabase
    .from('email_templates')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`メールテンプレートの更新に失敗しました: ${error.message}`)
  }

  return template
}

/** メールテンプレート削除 */
export async function deleteEmailTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from('email_templates')
    .delete()
    .eq('id', id)

  if (error) {
    throw new Error(`メールテンプレートの削除に失敗しました: ${error.message}`)
  }
}

// ========================================
// 注意事項テンプレート
// ========================================

/** 注意事項テンプレート一覧取得 */
export async function getCautionTemplates(): Promise<CautionTemplate[]> {
  const { data, error } = await supabase
    .from('caution_templates')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`注意事項テンプレート一覧の取得に失敗しました: ${error.message}`)
  }

  return data
}

/** 注意事項テンプレート取得 */
export async function getCautionTemplate(id: string): Promise<CautionTemplate> {
  const { data, error } = await supabase
    .from('caution_templates')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    throw new Error(`注意事項テンプレートの取得に失敗しました: ${error.message}`)
  }

  return data
}

/** 注意事項テンプレート作成 */
export async function createCautionTemplate(
  data: CautionTemplateInsert
): Promise<CautionTemplate> {
  const { data: template, error } = await supabase
    .from('caution_templates')
    .insert(data)
    .select()
    .single()

  if (error) {
    throw new Error(`注意事項テンプレートの作成に失敗しました: ${error.message}`)
  }

  return template
}

/** 注意事項テンプレート更新 */
export async function updateCautionTemplate(
  id: string,
  data: CautionTemplateUpdate
): Promise<CautionTemplate> {
  const { data: template, error } = await supabase
    .from('caution_templates')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`注意事項テンプレートの更新に失敗しました: ${error.message}`)
  }

  return template
}

/** 注意事項テンプレート削除 */
export async function deleteCautionTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from('caution_templates')
    .delete()
    .eq('id', id)

  if (error) {
    throw new Error(`注意事項テンプレートの削除に失敗しました: ${error.message}`)
  }
}

// ========================================
// アンケートテンプレート
// ========================================

/** アンケートテンプレート一覧取得 */
export async function getSurveyTemplates(): Promise<SurveyTemplate[]> {
  const { data, error } = await supabase
    .from('survey_templates')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`アンケートテンプレート一覧の取得に失敗しました: ${error.message}`)
  }

  return data
}

/** アンケートテンプレート取得 */
export async function getSurveyTemplate(id: string): Promise<SurveyTemplate> {
  const { data, error } = await supabase
    .from('survey_templates')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    throw new Error(`アンケートテンプレートの取得に失敗しました: ${error.message}`)
  }

  return data
}

/** アンケートテンプレート作成 */
export async function createSurveyTemplate(
  data: SurveyTemplateInsert
): Promise<SurveyTemplate> {
  const { data: template, error } = await supabase
    .from('survey_templates')
    .insert(data)
    .select()
    .single()

  if (error) {
    throw new Error(`アンケートテンプレートの作成に失敗しました: ${error.message}`)
  }

  return template
}

/** アンケートテンプレート更新 */
export async function updateSurveyTemplate(
  id: string,
  data: SurveyTemplateUpdate
): Promise<SurveyTemplate> {
  const { data: template, error } = await supabase
    .from('survey_templates')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`アンケートテンプレートの更新に失敗しました: ${error.message}`)
  }

  return template
}

/** アンケートテンプレート削除 */
export async function deleteSurveyTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from('survey_templates')
    .delete()
    .eq('id', id)

  if (error) {
    throw new Error(`アンケートテンプレートの削除に失敗しました: ${error.message}`)
  }
}

/** アンケートテンプレートからイベントに設問を一括作成 */
export async function applySurveyTemplate(
  templateId: string,
  eventId: string
): Promise<SurveyQuestion[]> {
  // 1. テンプレートを取得
  const template = await getSurveyTemplate(templateId)

  // 2. questions_json をパース
  const questions = template.questions_json as unknown as SurveyTemplateQuestion[]

  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('テンプレートに設問が含まれていません')
  }

  // 3. 各設問をsurvey_questionsとして作成
  const questionRows = questions.map((q, index) => ({
    event_id: eventId,
    question_text: q.question_text,
    question_type: q.question_type,
    is_required: q.is_required,
    sort_order: index + 1,
    options_json: q.options ?? null,
  }))

  const { data, error } = await supabase
    .from('survey_questions')
    .insert(questionRows)
    .select()

  if (error) {
    throw new Error(`アンケートテンプレートの適用に失敗しました: ${error.message}`)
  }

  return data
}
