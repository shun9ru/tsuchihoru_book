export type { Database } from './database'

import type { Database } from './database'

// Row types
export type User = Database['public']['Tables']['users']['Row']
export type UserInsert = Database['public']['Tables']['users']['Insert']
export type UserUpdate = Database['public']['Tables']['users']['Update']

export type Event = Database['public']['Tables']['events']['Row']
export type EventInsert = Database['public']['Tables']['events']['Insert']
export type EventUpdate = Database['public']['Tables']['events']['Update']

export type Reservation = Database['public']['Tables']['reservations']['Row']
export type ReservationInsert = Database['public']['Tables']['reservations']['Insert']
export type ReservationUpdate = Database['public']['Tables']['reservations']['Update']

export type SurveyQuestion = Database['public']['Tables']['survey_questions']['Row']
export type SurveyQuestionInsert = Database['public']['Tables']['survey_questions']['Insert']
export type SurveyQuestionUpdate = Database['public']['Tables']['survey_questions']['Update']

export type SurveyAnswer = Database['public']['Tables']['survey_answers']['Row']
export type SurveyAnswerInsert = Database['public']['Tables']['survey_answers']['Insert']
export type SurveyAnswerUpdate = Database['public']['Tables']['survey_answers']['Update']

export type BulkEmail = Database['public']['Tables']['bulk_emails']['Row']
export type BulkEmailInsert = Database['public']['Tables']['bulk_emails']['Insert']
export type BulkEmailUpdate = Database['public']['Tables']['bulk_emails']['Update']

export type BulkEmailLog = Database['public']['Tables']['bulk_email_logs']['Row']
export type BulkEmailLogInsert = Database['public']['Tables']['bulk_email_logs']['Insert']
export type BulkEmailLogUpdate = Database['public']['Tables']['bulk_email_logs']['Update']

export type Waitlist = Database['public']['Tables']['waitlists']['Row']
export type WaitlistInsert = Database['public']['Tables']['waitlists']['Insert']
export type WaitlistUpdate = Database['public']['Tables']['waitlists']['Update']

export type EmailTemplate = Database['public']['Tables']['email_templates']['Row']
export type EmailTemplateInsert = Database['public']['Tables']['email_templates']['Insert']
export type EmailTemplateUpdate = Database['public']['Tables']['email_templates']['Update']

export type CautionTemplate = Database['public']['Tables']['caution_templates']['Row']
export type CautionTemplateInsert = Database['public']['Tables']['caution_templates']['Insert']
export type CautionTemplateUpdate = Database['public']['Tables']['caution_templates']['Update']

export type SurveyTemplate = Database['public']['Tables']['survey_templates']['Row']
export type SurveyTemplateInsert = Database['public']['Tables']['survey_templates']['Insert']
export type SurveyTemplateUpdate = Database['public']['Tables']['survey_templates']['Update']

export type ReminderJob = Database['public']['Tables']['reminder_jobs']['Row']
export type ReminderJobInsert = Database['public']['Tables']['reminder_jobs']['Insert']
export type ReminderJobUpdate = Database['public']['Tables']['reminder_jobs']['Update']

export type EventTimeSlot = Database['public']['Tables']['event_time_slots']['Row']
export type EventTimeSlotInsert = Database['public']['Tables']['event_time_slots']['Insert']
export type EventTimeSlotUpdate = Database['public']['Tables']['event_time_slots']['Update']

export type EventDate = Database['public']['Tables']['event_dates']['Row']
export type EventDateInsert = Database['public']['Tables']['event_dates']['Insert']
export type EventDateUpdate = Database['public']['Tables']['event_dates']['Update']

export const SLOT_INTERVAL_OPTIONS = [
  { value: 15, label: '15分' },
  { value: 30, label: '30分' },
  { value: 45, label: '45分' },
  { value: 60, label: '60分' },
  { value: 90, label: '90分' },
  { value: 120, label: '120分' },
] as const

// App-level types
export type ReservationStatus = 'confirmed' | 'cancelled' | 'attended' | 'no_show'
export type QuestionType = 'single_choice' | 'multiple_choice' | 'free_text'
export type EmailStatus = 'draft' | 'sending' | 'sent' | 'failed'
export type SendStatus = 'pending' | 'sent' | 'failed'
export type UserRole = 'admin' | 'editor' | 'viewer'
export type WaitlistStatus = 'waiting' | 'promoted' | 'cancelled'
export type ReminderType = '3_days_before' | '1_day_before' | 'morning_of'
export type ReminderStatus = 'pending' | 'sent' | 'failed' | 'skipped'

// Survey template question structure
export interface SurveyTemplateQuestion {
  question_text: string
  question_type: QuestionType
  is_required: boolean
  options?: string[]
}

// Survey question with typed options
export interface SurveyQuestionWithOptions {
  id: string
  event_id: string
  question_text: string
  question_type: QuestionType
  is_required: boolean
  sort_order: number
  options: string[]
}

// Reservation with survey answers
export interface ReservationWithAnswers {
  reservation: Reservation
  answers: SurveyAnswer[]
}

// Stats types
export interface EventStats {
  totalReservations: number
  totalParticipants: number
  remainingCapacity: number
  surveyResponseCount: number
}
