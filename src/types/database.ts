export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          role: string
          display_name: string | null
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          role?: string
          display_name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          role?: string
          display_name?: string | null
          created_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          id: string
          title: string
          description: string | null
          event_date: string
          start_time: string
          end_time: string
          location: string
          capacity: number
          fee: number
          target_audience: string | null
          belongings: string | null
          caution_text: string | null
          caution_version: number
          reservation_start_at: string | null
          reservation_end_at: string | null
          is_published: boolean
          is_accepting: boolean
          use_time_slots: boolean
          use_multi_dates: boolean
          slot_interval_minutes: number
          slot_capacity: number
          allow_multi_slot_reservation: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          event_date: string
          start_time: string
          end_time: string
          location: string
          capacity: number
          fee?: number
          target_audience?: string | null
          belongings?: string | null
          caution_text?: string | null
          caution_version?: number
          reservation_start_at?: string | null
          reservation_end_at?: string | null
          is_published?: boolean
          is_accepting?: boolean
          use_time_slots?: boolean
          use_multi_dates?: boolean
          slot_interval_minutes?: number
          slot_capacity?: number
          allow_multi_slot_reservation?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          event_date?: string
          start_time?: string
          end_time?: string
          location?: string
          capacity?: number
          fee?: number
          target_audience?: string | null
          belongings?: string | null
          caution_text?: string | null
          caution_version?: number
          reservation_start_at?: string | null
          reservation_end_at?: string | null
          is_published?: boolean
          is_accepting?: boolean
          use_time_slots?: boolean
          use_multi_dates?: boolean
          slot_interval_minutes?: number
          slot_capacity?: number
          allow_multi_slot_reservation?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'events_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      reservations: {
        Row: {
          id: string
          event_id: string
          name: string
          email: string
          phone: string
          participant_count: number
          note: string | null
          status: string
          agreed_to_caution: boolean
          agreed_at: string | null
          caution_version: number | null
          time_slot_id: string | null
          event_date_id: string | null
          customer_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          name: string
          email: string
          phone: string
          participant_count?: number
          note?: string | null
          status?: string
          agreed_to_caution?: boolean
          agreed_at?: string | null
          caution_version?: number | null
          time_slot_id?: string | null
          event_date_id?: string | null
          customer_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          name?: string
          email?: string
          phone?: string
          participant_count?: number
          note?: string | null
          status?: string
          agreed_to_caution?: boolean
          agreed_at?: string | null
          caution_version?: number | null
          time_slot_id?: string | null
          event_date_id?: string | null
          customer_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'reservations_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'reservations_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'customers'
            referencedColumns: ['id']
          },
        ]
      }
      survey_questions: {
        Row: {
          id: string
          event_id: string
          question_text: string
          question_type: string
          is_required: boolean
          sort_order: number
          options_json: Json | null
          parent_question_id: string | null
          condition_value: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          event_id: string
          question_text: string
          question_type: string
          is_required?: boolean
          sort_order: number
          options_json?: Json | null
          parent_question_id?: string | null
          condition_value?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          question_text?: string
          question_type?: string
          is_required?: boolean
          sort_order?: number
          options_json?: Json | null
          parent_question_id?: string | null
          condition_value?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'survey_questions_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
        ]
      }
      survey_answers: {
        Row: {
          id: string
          reservation_id: string
          question_id: string
          answer_text: string | null
          answer_json: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          reservation_id: string
          question_id: string
          answer_text?: string | null
          answer_json?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          reservation_id?: string
          question_id?: string
          answer_text?: string | null
          answer_json?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'survey_answers_reservation_id_fkey'
            columns: ['reservation_id']
            isOneToOne: false
            referencedRelation: 'reservations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'survey_answers_question_id_fkey'
            columns: ['question_id']
            isOneToOne: false
            referencedRelation: 'survey_questions'
            referencedColumns: ['id']
          },
        ]
      }
      bulk_emails: {
        Row: {
          id: string
          event_id: string
          subject: string
          body: string
          sent_by: string | null
          sent_at: string | null
          target_count: number | null
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          subject: string
          body: string
          sent_by?: string | null
          sent_at?: string | null
          target_count?: number | null
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          subject?: string
          body?: string
          sent_by?: string | null
          sent_at?: string | null
          target_count?: number | null
          status?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'bulk_emails_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'bulk_emails_sent_by_fkey'
            columns: ['sent_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      bulk_email_logs: {
        Row: {
          id: string
          bulk_email_id: string
          reservation_id: string
          email: string
          send_status: string
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          bulk_email_id: string
          reservation_id: string
          email: string
          send_status?: string
          error_message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          bulk_email_id?: string
          reservation_id?: string
          email?: string
          send_status?: string
          error_message?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'bulk_email_logs_bulk_email_id_fkey'
            columns: ['bulk_email_id']
            isOneToOne: false
            referencedRelation: 'bulk_emails'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'bulk_email_logs_reservation_id_fkey'
            columns: ['reservation_id']
            isOneToOne: false
            referencedRelation: 'reservations'
            referencedColumns: ['id']
          },
        ]
      }
      waitlists: {
        Row: {
          id: string
          event_id: string
          name: string
          email: string
          phone: string
          participant_count: number
          note: string | null
          status: string
          promoted_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          name: string
          email: string
          phone: string
          participant_count?: number
          note?: string | null
          status?: string
          promoted_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          name?: string
          email?: string
          phone?: string
          participant_count?: number
          note?: string | null
          status?: string
          promoted_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'waitlists_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
        ]
      }
      email_templates: {
        Row: {
          id: string
          name: string
          subject: string
          body: string
          description: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          subject: string
          body: string
          description?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          subject?: string
          body?: string
          description?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'email_templates_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      caution_templates: {
        Row: {
          id: string
          name: string
          caution_text: string
          description: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          caution_text: string
          description?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          caution_text?: string
          description?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'caution_templates_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      survey_templates: {
        Row: {
          id: string
          name: string
          description: string | null
          questions_json: Json
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          questions_json: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          questions_json?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'survey_templates_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      event_dates: {
        Row: {
          id: string
          event_id: string
          event_date: string
          start_time: string
          end_time: string | null
          capacity: number
          is_available: boolean
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          event_date: string
          start_time: string
          end_time?: string | null
          capacity?: number
          is_available?: boolean
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          event_date?: string
          start_time?: string
          end_time?: string | null
          capacity?: number
          is_available?: boolean
          sort_order?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'event_dates_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
        ]
      }
      event_time_slots: {
        Row: {
          id: string
          event_id: string
          start_time: string
          end_time: string
          capacity: number
          is_available: boolean
          sort_order: number
          event_date_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          start_time: string
          end_time: string
          capacity?: number
          is_available?: boolean
          sort_order?: number
          event_date_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          start_time?: string
          end_time?: string
          capacity?: number
          is_available?: boolean
          sort_order?: number
          event_date_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'event_time_slots_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
        ]
      }
      customers: {
        Row: {
          id: string
          auth_user_id: string | null
          name: string
          email: string
          prefecture: string | null
          age_group: string | null
          memo: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          auth_user_id?: string | null
          name: string
          email: string
          prefecture?: string | null
          age_group?: string | null
          memo?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          auth_user_id?: string | null
          name?: string
          email?: string
          prefecture?: string | null
          age_group?: string | null
          memo?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      reminder_jobs: {
        Row: {
          id: string
          event_id: string
          remind_type: string
          subject: string
          body: string
          is_enabled: boolean
          scheduled_at: string | null
          sent_at: string | null
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          remind_type: string
          subject: string
          body: string
          is_enabled?: boolean
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          remind_type?: string
          subject?: string
          body?: string
          is_enabled?: boolean
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'reminder_jobs_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
