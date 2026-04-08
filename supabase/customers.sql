-- =============================================================================
-- 顧客カルテ機能: customers テーブル + reservations.customer_id 追加
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. customers テーブル
-- -----------------------------------------------------------------------------
CREATE TABLE customers (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id  uuid        UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  name          text        NOT NULL,
  email         text        NOT NULL,
  prefecture    text,
  age_group     text        CHECK (age_group IN (
    '未就学児','小学生','中学生','高校生',
    '20代','30代','40代','50代','60代','70代以上'
  )),
  memo          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_customers_auth_user_id ON customers(auth_user_id);
CREATE INDEX idx_customers_email ON customers(email);

-- updated_at 自動更新トリガー
CREATE TRIGGER trigger_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 2. reservations に customer_id カラム追加
-- -----------------------------------------------------------------------------
ALTER TABLE reservations
  ADD COLUMN customer_id uuid REFERENCES customers(id) ON DELETE SET NULL;

CREATE INDEX idx_reservations_customer_id ON reservations(customer_id);

-- -----------------------------------------------------------------------------
-- 3. auth trigger 修正: 顧客登録時は public.users に挿入しない
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  IF COALESCE(NEW.raw_user_meta_data->>'role', 'admin') = 'customer' THEN
    -- 顧客: customers テーブルにレコード作成（メタデータから情報取得）
    INSERT INTO public.customers (auth_user_id, name, email, prefecture, age_group)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
      NEW.email,
      NULLIF(NEW.raw_user_meta_data->>'prefecture', ''),
      NULLIF(NEW.raw_user_meta_data->>'age_group', '')
    );
  ELSE
    -- 管理者: users テーブルにレコード作成
    INSERT INTO public.users (id, email, role, display_name)
    VALUES (
      NEW.id,
      NEW.email,
      'admin',
      COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- 4. RLS ヘルパー関数
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_customer()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM customers
    WHERE auth_user_id = auth.uid()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- 5. customers テーブル RLS
-- -----------------------------------------------------------------------------
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- 管理者: 全顧客を閲覧・操作可能
CREATE POLICY "customers_select_admin"
  ON customers FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "customers_insert_admin"
  ON customers FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "customers_update_admin"
  ON customers FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "customers_delete_admin"
  ON customers FOR DELETE TO authenticated
  USING (is_admin());

-- 顧客: 自分のレコードのみ閲覧・更新可能
CREATE POLICY "customers_select_own"
  ON customers FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

CREATE POLICY "customers_update_own"
  ON customers FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- 顧客: 自分のレコードを登録可能
CREATE POLICY "customers_insert_own"
  ON customers FOR INSERT TO authenticated
  WITH CHECK (auth_user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 6. reservations テーブル RLS 追加（顧客が自分の予約を閲覧可能に）
-- -----------------------------------------------------------------------------

-- 顧客: 自分の予約を閲覧可能
CREATE POLICY "reservations_select_customer"
  ON reservations FOR SELECT TO authenticated
  USING (
    customer_id IN (
      SELECT id FROM customers WHERE auth_user_id = auth.uid()
    )
  );

-- 顧客: 予約を作成可能（customer_id が自分 or null）
CREATE POLICY "reservations_insert_customer"
  ON reservations FOR INSERT TO authenticated
  WITH CHECK (
    customer_id IS NULL
    OR customer_id IN (
      SELECT id FROM customers WHERE auth_user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- 7. survey_answers テーブル RLS 追加（顧客がアンケート回答を作成可能に）
-- -----------------------------------------------------------------------------

-- 顧客: アンケート回答を作成可能
CREATE POLICY "survey_answers_insert_customer"
  ON survey_answers FOR INSERT TO authenticated
  WITH CHECK (is_customer());

-- 顧客: 自分の予約のアンケート回答を閲覧可能
CREATE POLICY "survey_answers_select_customer"
  ON survey_answers FOR SELECT TO authenticated
  USING (
    reservation_id IN (
      SELECT r.id FROM reservations r
      JOIN customers c ON c.id = r.customer_id
      WHERE c.auth_user_id = auth.uid()
    )
  );
