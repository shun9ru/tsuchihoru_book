-- =============================================================================
-- Row Level Security (RLS) ポリシー設定
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ヘルパー関数: 管理者ユーザーかどうかを判定
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- =============================================================================
-- events（イベント）テーブル
-- =============================================================================

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- 公開済みイベントは誰でも閲覧可能
CREATE POLICY "events_select_published"
  ON events FOR SELECT
  USING (is_published = true);

-- 認証済み管理者は全イベントを閲覧可能
CREATE POLICY "events_select_admin"
  ON events FOR SELECT
  TO authenticated
  USING (is_admin());

-- 認証済み管理者はイベントを作成可能
CREATE POLICY "events_insert_admin"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- 認証済み管理者はイベントを更新可能
CREATE POLICY "events_update_admin"
  ON events FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- 認証済み管理者はイベントを削除可能
CREATE POLICY "events_delete_admin"
  ON events FOR DELETE
  TO authenticated
  USING (is_admin());

-- =============================================================================
-- reservations（予約）テーブル
-- =============================================================================

ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- 匿名ユーザーは予約を作成可能（一般予約フォームから）
CREATE POLICY "reservations_insert_anon"
  ON reservations FOR INSERT
  TO anon
  WITH CHECK (true);

-- 認証済みユーザーも予約を作成可能（管理画面から手動追加）
CREATE POLICY "reservations_insert_authenticated"
  ON reservations FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- 認証済み管理者は全予約を閲覧可能
CREATE POLICY "reservations_select_admin"
  ON reservations FOR SELECT
  TO authenticated
  USING (is_admin());

-- 認証済み管理者は予約を更新可能
CREATE POLICY "reservations_update_admin"
  ON reservations FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- 認証済み管理者は予約を削除可能
CREATE POLICY "reservations_delete_admin"
  ON reservations FOR DELETE
  TO authenticated
  USING (is_admin());

-- =============================================================================
-- survey_questions（アンケート質問）テーブル
-- =============================================================================

ALTER TABLE survey_questions ENABLE ROW LEVEL SECURITY;

-- アンケート質問は誰でも閲覧可能（予約フォームで表示するため）
CREATE POLICY "survey_questions_select_all"
  ON survey_questions FOR SELECT
  USING (true);

-- 認証済み管理者はアンケート質問を作成可能
CREATE POLICY "survey_questions_insert_admin"
  ON survey_questions FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- 認証済み管理者はアンケート質問を更新可能
CREATE POLICY "survey_questions_update_admin"
  ON survey_questions FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- 認証済み管理者はアンケート質問を削除可能
CREATE POLICY "survey_questions_delete_admin"
  ON survey_questions FOR DELETE
  TO authenticated
  USING (is_admin());

-- =============================================================================
-- survey_answers（アンケート回答）テーブル
-- =============================================================================

ALTER TABLE survey_answers ENABLE ROW LEVEL SECURITY;

-- 匿名ユーザーはアンケート回答を作成可能（予約フォームから）
CREATE POLICY "survey_answers_insert_anon"
  ON survey_answers FOR INSERT
  TO anon
  WITH CHECK (true);

-- 認証済みユーザーもアンケート回答を作成可能
CREATE POLICY "survey_answers_insert_authenticated"
  ON survey_answers FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- 認証済み管理者はアンケート回答を閲覧可能
CREATE POLICY "survey_answers_select_admin"
  ON survey_answers FOR SELECT
  TO authenticated
  USING (is_admin());

-- =============================================================================
-- bulk_emails（一括メール）テーブル
-- =============================================================================

ALTER TABLE bulk_emails ENABLE ROW LEVEL SECURITY;

-- 認証済み管理者のみ全操作可能
CREATE POLICY "bulk_emails_select_admin"
  ON bulk_emails FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "bulk_emails_insert_admin"
  ON bulk_emails FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "bulk_emails_update_admin"
  ON bulk_emails FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "bulk_emails_delete_admin"
  ON bulk_emails FOR DELETE
  TO authenticated
  USING (is_admin());

-- =============================================================================
-- bulk_email_logs（一括メール送信ログ）テーブル
-- =============================================================================

ALTER TABLE bulk_email_logs ENABLE ROW LEVEL SECURITY;

-- 認証済み管理者のみ全操作可能
CREATE POLICY "bulk_email_logs_select_admin"
  ON bulk_email_logs FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "bulk_email_logs_insert_admin"
  ON bulk_email_logs FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "bulk_email_logs_update_admin"
  ON bulk_email_logs FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "bulk_email_logs_delete_admin"
  ON bulk_email_logs FOR DELETE
  TO authenticated
  USING (is_admin());

-- =============================================================================
-- users（ユーザー）テーブル
-- =============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 自分自身のユーザー情報を閲覧可能
CREATE POLICY "users_select_own"
  ON users FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- 管理者は全ユーザー情報を閲覧可能
CREATE POLICY "users_select_admin"
  ON users FOR SELECT
  TO authenticated
  USING (is_admin());

-- 自分自身のユーザー情報を更新可能
CREATE POLICY "users_update_own"
  ON users FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 管理者は全ユーザー情報を操作可能
CREATE POLICY "users_insert_admin"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "users_update_admin"
  ON users FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "users_delete_admin"
  ON users FOR DELETE
  TO authenticated
  USING (is_admin());
