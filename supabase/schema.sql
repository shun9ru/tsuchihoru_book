-- =============================================================================
-- イベント予約システム データベーススキーマ
-- =============================================================================

-- UUID拡張機能の有効化
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- テーブル定義
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ユーザーテーブル（Supabase auth.usersの拡張）
-- -----------------------------------------------------------------------------
CREATE TABLE users (
  id           uuid        PRIMARY KEY REFERENCES auth.users(id),
  email        text        NOT NULL,
  role         text        NOT NULL DEFAULT 'admin'
                           CHECK (role IN ('admin', 'editor', 'viewer')),
  display_name text,
  created_at   timestamptz DEFAULT now()
);

COMMENT ON TABLE users IS '管理ユーザー情報（Supabase認証と連携）';

-- -----------------------------------------------------------------------------
-- イベントテーブル
-- -----------------------------------------------------------------------------
CREATE TABLE events (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title                text        NOT NULL,
  description          text,
  event_date           date        NOT NULL,
  start_time           time        NOT NULL,
  end_time             time,
  location             text        NOT NULL,
  capacity             integer     NOT NULL DEFAULT 0,
  fee                  integer     NOT NULL DEFAULT 0,
  target_audience      text,
  belongings           text,
  caution_text         text,
  caution_version      integer     NOT NULL DEFAULT 1,
  reservation_start_at timestamptz,
  reservation_end_at   timestamptz,
  is_published         boolean     NOT NULL DEFAULT false,
  is_accepting         boolean     NOT NULL DEFAULT false,
  created_by           uuid        REFERENCES users(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE events IS 'イベント情報';

-- -----------------------------------------------------------------------------
-- 予約テーブル
-- -----------------------------------------------------------------------------
CREATE TABLE reservations (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name              text        NOT NULL,
  email             text        NOT NULL,
  phone             text        NOT NULL,
  participant_count integer     NOT NULL DEFAULT 1,
  note              text,
  status            text        NOT NULL DEFAULT 'confirmed'
                                CHECK (status IN ('confirmed', 'cancelled', 'attended', 'no_show')),
  agreed_to_caution boolean     NOT NULL DEFAULT false,
  agreed_at         timestamptz,
  caution_version   integer,
  created_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE reservations IS '予約情報';

-- -----------------------------------------------------------------------------
-- アンケート質問テーブル
-- -----------------------------------------------------------------------------
CREATE TABLE survey_questions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  question_text text        NOT NULL,
  question_type text        NOT NULL
                            CHECK (question_type IN ('single_choice', 'multiple_choice', 'free_text')),
  is_required   boolean     NOT NULL DEFAULT false,
  sort_order    integer     NOT NULL DEFAULT 0,
  options_json  jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE survey_questions IS 'アンケート質問';

-- -----------------------------------------------------------------------------
-- アンケート回答テーブル
-- -----------------------------------------------------------------------------
CREATE TABLE survey_answers (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid        NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  question_id    uuid        NOT NULL REFERENCES survey_questions(id) ON DELETE CASCADE,
  answer_text    text,
  answer_json    jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE survey_answers IS 'アンケート回答';

-- -----------------------------------------------------------------------------
-- 一括メールテーブル
-- -----------------------------------------------------------------------------
CREATE TABLE bulk_emails (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  subject      text        NOT NULL,
  body         text        NOT NULL,
  sent_by      uuid        REFERENCES users(id),
  sent_at      timestamptz,
  target_count integer     NOT NULL DEFAULT 0,
  status       text        NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft', 'sending', 'sent', 'failed')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE bulk_emails IS '一括メール送信';

-- -----------------------------------------------------------------------------
-- 一括メール送信ログテーブル
-- -----------------------------------------------------------------------------
CREATE TABLE bulk_email_logs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  bulk_email_id uuid        NOT NULL REFERENCES bulk_emails(id) ON DELETE CASCADE,
  reservation_id uuid       REFERENCES reservations(id),
  email         text        NOT NULL,
  send_status   text        NOT NULL DEFAULT 'pending'
                            CHECK (send_status IN ('pending', 'sent', 'failed')),
  error_message text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE bulk_email_logs IS '一括メール送信ログ';

-- =============================================================================
-- インデックス
-- =============================================================================

CREATE INDEX idx_reservations_event_id     ON reservations(event_id);
CREATE INDEX idx_reservations_email        ON reservations(email);
CREATE INDEX idx_survey_questions_event    ON survey_questions(event_id, sort_order);
CREATE INDEX idx_survey_answers_reservation ON survey_answers(reservation_id);
CREATE INDEX idx_survey_answers_question   ON survey_answers(question_id);
CREATE INDEX idx_bulk_emails_event_id      ON bulk_emails(event_id);
CREATE INDEX idx_bulk_email_logs_bulk_email ON bulk_email_logs(bulk_email_id);
CREATE INDEX idx_events_event_date         ON events(event_date);
CREATE INDEX idx_events_is_published       ON events(is_published);

-- =============================================================================
-- updated_atトリガー関数
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- eventsテーブルにトリガーを適用
CREATE TRIGGER trigger_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- survey_questionsテーブルにトリガーを適用
CREATE TRIGGER trigger_survey_questions_updated_at
  BEFORE UPDATE ON survey_questions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 確認済み参加者数を取得する関数（定員チェック用）
-- =============================================================================

CREATE OR REPLACE FUNCTION get_confirmed_participant_count(p_event_id uuid)
RETURNS integer AS $$
  SELECT COALESCE(SUM(participant_count), 0)::integer
  FROM reservations
  WHERE event_id = p_event_id AND status = 'confirmed';
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION get_confirmed_participant_count(uuid) IS '指定イベントの確認済み参加者数を取得する';
