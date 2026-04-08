-- =============================================================================
-- アクセス解析: page_views テーブル
-- =============================================================================

CREATE TABLE page_views (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  path        text        NOT NULL,
  referrer    text,
  referrer_source text,
  utm_source  text,
  utm_medium  text,
  utm_campaign text,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_page_views_created_at ON page_views(created_at);
CREATE INDEX idx_page_views_path ON page_views(path);
CREATE INDEX idx_page_views_referrer_source ON page_views(referrer_source);

-- RLS
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;

-- 誰でも記録可能（ページ閲覧時）
CREATE POLICY "page_views_insert_anon"
  ON page_views FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "page_views_insert_authenticated"
  ON page_views FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 管理者のみ閲覧可能
CREATE POLICY "page_views_select_admin"
  ON page_views FOR SELECT
  TO authenticated
  USING (is_admin());
