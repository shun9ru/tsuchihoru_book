-- =============================================================================
-- Phase 2 マイグレーション: キャンセル待ち・テンプレート・リマインド機能
-- =============================================================================
-- 既存の schema.sql / rls.sql の上に適用する追加マイグレーション

-- =============================================================================
-- 1. waitlists（キャンセル待ち）テーブル
-- =============================================================================

CREATE TABLE waitlists (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name              text        NOT NULL,
  email             text        NOT NULL,
  phone             text        NOT NULL,
  participant_count integer     NOT NULL DEFAULT 1,
  note              text,
  status            text        NOT NULL DEFAULT 'waiting'
                                CHECK (status IN ('waiting', 'promoted', 'cancelled')),
  promoted_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE waitlists IS 'キャンセル待ち情報';

-- イベント別・ステータス別の待ち順序取得用インデックス
CREATE INDEX idx_waitlists_event_status_created
  ON waitlists(event_id, status, created_at);

-- =============================================================================
-- 2. email_templates（メールテンプレート）テーブル
-- =============================================================================

CREATE TABLE email_templates (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  subject     text        NOT NULL,
  body        text        NOT NULL,
  description text,
  created_by  uuid        REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE email_templates IS 'メールテンプレート（一括メール等で再利用可能なテンプレート）';

-- updated_at 自動更新トリガー
CREATE TRIGGER trigger_email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 3. caution_templates（注意事項テンプレート）テーブル
-- =============================================================================

CREATE TABLE caution_templates (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text        NOT NULL,
  caution_text text        NOT NULL,
  description  text,
  created_by   uuid        REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE caution_templates IS '注意事項テンプレート（イベント作成時に選択可能）';

-- updated_at 自動更新トリガー
CREATE TRIGGER trigger_caution_templates_updated_at
  BEFORE UPDATE ON caution_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 4. survey_templates（アンケートテンプレート）テーブル
-- =============================================================================

CREATE TABLE survey_templates (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text        NOT NULL,
  description    text,
  questions_json jsonb       NOT NULL,
  created_by     uuid        REFERENCES users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE survey_templates IS 'アンケートテンプレート（questions_json: [{question_text, question_type, is_required, options}]）';

-- updated_at 自動更新トリガー
CREATE TRIGGER trigger_survey_templates_updated_at
  BEFORE UPDATE ON survey_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 5. reminder_jobs（リマインドメール設定）テーブル
-- =============================================================================

CREATE TABLE reminder_jobs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  remind_type  text        NOT NULL
                           CHECK (remind_type IN ('3_days_before', '1_day_before', 'morning_of')),
  subject      text        NOT NULL,
  body         text        NOT NULL,
  is_enabled   boolean     NOT NULL DEFAULT true,
  scheduled_at timestamptz,
  sent_at      timestamptz,
  status       text        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE reminder_jobs IS 'リマインドメール設定（イベントごとに送信タイミングを管理）';

-- イベント別インデックス
CREATE INDEX idx_reminder_jobs_event_id
  ON reminder_jobs(event_id);

-- ステータス・送信予定日時別インデックス（バッチ処理で未送信ジョブを検索）
CREATE INDEX idx_reminder_jobs_status_scheduled
  ON reminder_jobs(status, scheduled_at);

-- 同一イベント・同一タイプの重複を防止
ALTER TABLE reminder_jobs
  ADD CONSTRAINT uq_reminder_jobs_event_type
  UNIQUE (event_id, remind_type);

-- =============================================================================
-- 6. RLS ポリシー設定
-- =============================================================================

-- -----------------------------------------------------------------------------
-- waitlists（キャンセル待ち）
-- -----------------------------------------------------------------------------

ALTER TABLE waitlists ENABLE ROW LEVEL SECURITY;

-- 匿名ユーザーはキャンセル待ちに登録可能（公開フォームから）
CREATE POLICY "waitlists_insert_anon"
  ON waitlists FOR INSERT
  TO anon
  WITH CHECK (true);

-- 認証済みユーザーもキャンセル待ちを登録可能（管理画面から手動追加）
CREATE POLICY "waitlists_insert_authenticated"
  ON waitlists FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- 認証済み管理者はキャンセル待ちを閲覧可能
CREATE POLICY "waitlists_select_admin"
  ON waitlists FOR SELECT
  TO authenticated
  USING (is_admin());

-- 認証済み管理者はキャンセル待ちを更新可能（ステータス変更等）
CREATE POLICY "waitlists_update_admin"
  ON waitlists FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- 認証済み管理者はキャンセル待ちを削除可能
CREATE POLICY "waitlists_delete_admin"
  ON waitlists FOR DELETE
  TO authenticated
  USING (is_admin());

-- -----------------------------------------------------------------------------
-- email_templates（メールテンプレート）
-- -----------------------------------------------------------------------------

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- 認証済み管理者はメールテンプレートを閲覧可能
CREATE POLICY "email_templates_select_admin"
  ON email_templates FOR SELECT
  TO authenticated
  USING (is_admin());

-- 認証済み管理者はメールテンプレートを作成可能
CREATE POLICY "email_templates_insert_admin"
  ON email_templates FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- 認証済み管理者はメールテンプレートを更新可能
CREATE POLICY "email_templates_update_admin"
  ON email_templates FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- 認証済み管理者はメールテンプレートを削除可能
CREATE POLICY "email_templates_delete_admin"
  ON email_templates FOR DELETE
  TO authenticated
  USING (is_admin());

-- -----------------------------------------------------------------------------
-- caution_templates（注意事項テンプレート）
-- -----------------------------------------------------------------------------

ALTER TABLE caution_templates ENABLE ROW LEVEL SECURITY;

-- 認証済み管理者は注意事項テンプレートを閲覧可能
CREATE POLICY "caution_templates_select_admin"
  ON caution_templates FOR SELECT
  TO authenticated
  USING (is_admin());

-- 認証済み管理者は注意事項テンプレートを作成可能
CREATE POLICY "caution_templates_insert_admin"
  ON caution_templates FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- 認証済み管理者は注意事項テンプレートを更新可能
CREATE POLICY "caution_templates_update_admin"
  ON caution_templates FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- 認証済み管理者は注意事項テンプレートを削除可能
CREATE POLICY "caution_templates_delete_admin"
  ON caution_templates FOR DELETE
  TO authenticated
  USING (is_admin());

-- -----------------------------------------------------------------------------
-- survey_templates（アンケートテンプレート）
-- -----------------------------------------------------------------------------

ALTER TABLE survey_templates ENABLE ROW LEVEL SECURITY;

-- 認証済み管理者はアンケートテンプレートを閲覧可能
CREATE POLICY "survey_templates_select_admin"
  ON survey_templates FOR SELECT
  TO authenticated
  USING (is_admin());

-- 認証済み管理者はアンケートテンプレートを作成可能
CREATE POLICY "survey_templates_insert_admin"
  ON survey_templates FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- 認証済み管理者はアンケートテンプレートを更新可能
CREATE POLICY "survey_templates_update_admin"
  ON survey_templates FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- 認証済み管理者はアンケートテンプレートを削除可能
CREATE POLICY "survey_templates_delete_admin"
  ON survey_templates FOR DELETE
  TO authenticated
  USING (is_admin());

-- -----------------------------------------------------------------------------
-- reminder_jobs（リマインドメール設定）
-- -----------------------------------------------------------------------------

ALTER TABLE reminder_jobs ENABLE ROW LEVEL SECURITY;

-- 認証済み管理者はリマインドジョブを閲覧可能
CREATE POLICY "reminder_jobs_select_admin"
  ON reminder_jobs FOR SELECT
  TO authenticated
  USING (is_admin());

-- 認証済み管理者はリマインドジョブを作成可能
CREATE POLICY "reminder_jobs_insert_admin"
  ON reminder_jobs FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- 認証済み管理者はリマインドジョブを更新可能
CREATE POLICY "reminder_jobs_update_admin"
  ON reminder_jobs FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- 認証済み管理者はリマインドジョブを削除可能
CREATE POLICY "reminder_jobs_delete_admin"
  ON reminder_jobs FOR DELETE
  TO authenticated
  USING (is_admin());

-- =============================================================================
-- 7. ヘルパー関数: キャンセル待ちの順番を取得
-- =============================================================================

-- 指定されたキャンセル待ちエントリの現在の待ち順番（1始まり）を返す
CREATE OR REPLACE FUNCTION get_waitlist_position(p_waitlist_id uuid)
RETURNS integer AS $$
  SELECT count(*)::integer
  FROM waitlists w1
  JOIN waitlists w2 ON w1.event_id = w2.event_id
  WHERE w2.id = p_waitlist_id
    AND w1.status = 'waiting'
    AND w2.status = 'waiting'
    AND w1.created_at <= w2.created_at;
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION get_waitlist_position(uuid) IS '指定キャンセル待ちエントリの待ち順番を取得する（1 = 先頭）';
