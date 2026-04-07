import { supabase } from '@/lib/supabase'
import type {
  SurveyQuestion,
  SurveyQuestionInsert,
  SurveyQuestionUpdate,
  SurveyAnswer,
} from '@/types'

/** イベントのアンケート設問一覧取得 */
export async function getSurveyQuestions(eventId: string): Promise<SurveyQuestion[]> {
  const { data, error } = await supabase
    .from('survey_questions')
    .select('*')
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true })

  if (error) {
    throw new Error(`アンケート設問一覧の取得に失敗しました: ${error.message}`)
  }

  return data
}

/** アンケート設問作成 */
export async function createSurveyQuestion(
  data: SurveyQuestionInsert
): Promise<SurveyQuestion> {
  const { data: question, error } = await supabase
    .from('survey_questions')
    .insert(data)
    .select()
    .single()

  if (error) {
    throw new Error(`アンケート設問の作成に失敗しました: ${error.message}`)
  }

  return question
}

/** アンケート設問更新 */
export async function updateSurveyQuestion(
  id: string,
  data: SurveyQuestionUpdate
): Promise<SurveyQuestion> {
  const { data: question, error } = await supabase
    .from('survey_questions')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`アンケート設問の更新に失敗しました: ${error.message}`)
  }

  return question
}

/** アンケート設問削除 */
export async function deleteSurveyQuestion(id: string): Promise<void> {
  const { error } = await supabase
    .from('survey_questions')
    .delete()
    .eq('id', id)

  if (error) {
    throw new Error(`アンケート設問の削除に失敗しました: ${error.message}`)
  }
}

/** アンケート設問の並び順を一括更新 */
export async function reorderSurveyQuestions(
  questions: Array<{ id: string; sort_order: number }>
): Promise<void> {
  // 各設問のsort_orderを個別に更新
  const updates = questions.map(({ id, sort_order }) =>
    supabase
      .from('survey_questions')
      .update({ sort_order })
      .eq('id', id)
  )

  const results = await Promise.all(updates)

  const failed = results.find((r) => r.error)
  if (failed?.error) {
    throw new Error(`アンケート設問の並び替えに失敗しました: ${failed.error.message}`)
  }
}

/** イベントのアンケート回答集計 */
export async function getSurveyResults(
  eventId: string
): Promise<
  Array<{
    question: SurveyQuestion
    answers: SurveyAnswer[]
    optionCounts?: Record<string, number>
  }>
> {
  // 1. イベントの設問一覧を取得
  const questions = await getSurveyQuestions(eventId)

  if (questions.length === 0) {
    return []
  }

  // 2. 確定済み予約のIDを取得
  const { data: reservations, error: resError } = await supabase
    .from('reservations')
    .select('id')
    .eq('event_id', eventId)
    .eq('status', 'confirmed')

  if (resError) {
    throw new Error(`予約情報の取得に失敗しました: ${resError.message}`)
  }

  const reservationIds = reservations.map((r) => r.id)

  if (reservationIds.length === 0) {
    return questions.map((question) => ({
      question,
      answers: [],
      ...(question.question_type !== 'free_text' ? { optionCounts: {} } : {}),
    }))
  }

  // 3. 確定済み予約に紐づく回答を取得
  const { data: allAnswers, error: ansError } = await supabase
    .from('survey_answers')
    .select('*')
    .in('reservation_id', reservationIds)

  if (ansError) {
    throw new Error(`アンケート回答の取得に失敗しました: ${ansError.message}`)
  }

  // 4. 設問ごとに集計
  return questions.map((question) => {
    const answers = allAnswers.filter((a) => a.question_id === question.id)

    const result: {
      question: SurveyQuestion
      answers: SurveyAnswer[]
      optionCounts?: Record<string, number>
    } = { question, answers }

    // 選択式の設問は選択肢ごとのカウントを計算
    if (
      question.question_type === 'single_choice' ||
      question.question_type === 'multiple_choice'
    ) {
      const optionCounts: Record<string, number> = {}

      // options_jsonから選択肢を初期化
      const options = Array.isArray(question.options_json)
        ? (question.options_json as string[])
        : []
      for (const opt of options) {
        optionCounts[opt] = 0
      }

      for (const answer of answers) {
        if (question.question_type === 'single_choice') {
          // 単一選択: answer_textに値が入る
          const value = answer.answer_text
          if (value) {
            optionCounts[value] = (optionCounts[value] ?? 0) + 1
          }
        } else {
          // 複数選択: answer_jsonに配列が入る
          const values = Array.isArray(answer.answer_json)
            ? (answer.answer_json as string[])
            : []
          for (const value of values) {
            optionCounts[value] = (optionCounts[value] ?? 0) + 1
          }
        }
      }

      result.optionCounts = optionCounts
    }

    return result
  })
}
