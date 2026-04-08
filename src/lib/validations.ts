import { z } from 'zod'

export const reservationSchema = z.object({
  name: z
    .string()
    .min(1, '氏名は必須です'),
  email: z
    .string()
    .min(1, 'メールアドレスは必須です')
    .email('有効なメールアドレスを入力してください'),
  phone: z
    .string()
    .min(1, '電話番号は必須です')
    .regex(/^(0\d{1,4}-?\d{1,4}-?\d{3,4})$/, '有効な電話番号を入力してください（例: 090-1234-5678）'),
  participant_count: z
    .number({ message: '参加人数を入力してください' })
    .min(1, '参加人数は1名以上で入力してください')
    .max(10, '参加人数は10名以下で入力してください'),
  note: z
    .string()
    .optional(),
})

export type ReservationFormValues = z.infer<typeof reservationSchema>

export const eventSchema = z.object({
  title: z
    .string()
    .min(1, 'タイトルは必須です'),
  description: z
    .string()
    .optional(),
  event_date: z
    .string()
    .min(1, '開催日は必須です'),
  start_time: z
    .string()
    .min(1, '開始時間は必須です'),
  end_time: z
    .string()
    .min(1, '終了時間は必須です'),
  location: z
    .string()
    .min(1, '会場は必須です'),
  capacity: z
    .number({ message: '定員を入力してください' })
    .min(1, '定員は1名以上で入力してください'),
  fee: z
    .number({ message: '参加費を入力してください' })
    .min(0, '参加費は0以上で入力してください'),
  target_audience: z
    .string()
    .optional(),
  belongings: z
    .string()
    .optional(),
  caution_text: z
    .string()
    .optional(),
  reservation_start_at: z
    .string()
    .optional(),
  reservation_end_at: z
    .string()
    .optional(),
  is_published: z
    .boolean(),
  is_accepting: z
    .boolean(),
})

export type EventFormValues = z.infer<typeof eventSchema>

export const surveyQuestionSchema = z
  .object({
    question_text: z
      .string()
      .min(1, '質問文は必須です'),
    question_type: z
      .enum(['single_choice', 'multiple_choice', 'free_text'], '質問タイプを選択してください'),
    is_required: z
      .boolean()
      .default(false),
    options: z
      .array(z.string().min(1, '選択肢を入力してください'))
      .optional(),
  })
  .refine(
    (data) => {
      if (
        data.question_type === 'single_choice' ||
        data.question_type === 'multiple_choice'
      ) {
        return data.options && data.options.length >= 2
      }
      return true
    },
    {
      message: '選択式の質問には2つ以上の選択肢が必要です',
      path: ['options'],
    }
  )

export type SurveyQuestionFormValues = z.infer<typeof surveyQuestionSchema>

export const bulkEmailSchema = z.object({
  subject: z
    .string()
    .min(1, '件名は必須です'),
  body: z
    .string()
    .min(1, '本文は必須です'),
})

export type BulkEmailFormValues = z.infer<typeof bulkEmailSchema>

export const customerRegisterSchema = z.object({
  name: z
    .string()
    .min(1, '氏名は必須です'),
  email: z
    .string()
    .min(1, 'メールアドレスは必須です')
    .email('有効なメールアドレスを入力してください'),
  password: z
    .string()
    .min(6, 'パスワードは6文字以上で入力してください'),
  confirmPassword: z
    .string()
    .min(1, 'パスワード確認は必須です'),
  prefecture: z
    .string()
    .optional(),
  age_group: z
    .string()
    .optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'パスワードが一致しません',
  path: ['confirmPassword'],
})

export type CustomerRegisterFormValues = z.infer<typeof customerRegisterSchema>

export const customerProfileSchema = z.object({
  name: z
    .string()
    .min(1, '氏名は必須です'),
  prefecture: z
    .string()
    .optional(),
  age_group: z
    .string()
    .optional(),
})

export type CustomerProfileFormValues = z.infer<typeof customerProfileSchema>

export const customerLoginSchema = z.object({
  email: z
    .string()
    .min(1, 'メールアドレスは必須です')
    .email('有効なメールアドレスを入力してください'),
  password: z
    .string()
    .min(6, 'パスワードは6文字以上で入力してください'),
})

export type CustomerLoginFormValues = z.infer<typeof customerLoginSchema>

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'メールアドレスは必須です')
    .email('有効なメールアドレスを入力してください'),
  password: z
    .string()
    .min(6, 'パスワードは6文字以上で入力してください'),
})

export type LoginFormValues = z.infer<typeof loginSchema>
