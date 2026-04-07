-- =============================================================================
-- 複数日開催対応 マイグレーション
-- =============================================================================

-- 1. event_dates テーブル作成
CREATE TABLE event_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  event_date date NOT NULL,
  start_time time NOT NULL,
  end_time time,
  capacity integer NOT NULL DEFAULT 0,
  is_available boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_dates_event ON event_dates(event_id, sort_order);
CREATE INDEX idx_event_dates_date ON event_dates(event_date);

COMMENT ON TABLE event_dates IS '開催日（複数日対応）';

-- 2. events テーブルにカラム追加
ALTER TABLE events ADD COLUMN IF NOT EXISTS use_multi_dates boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN events.use_multi_dates IS '複数日開催を使用するかどうか';

-- 3. event_time_slots に event_date_id を追加（日付ごとの時間割）
ALTER TABLE event_time_slots ADD COLUMN IF NOT EXISTS event_date_id uuid REFERENCES event_dates(id) ON DELETE CASCADE;
CREATE INDEX idx_time_slots_event_date ON event_time_slots(event_date_id);

-- 4. reservations に event_date_id を追加（どの日の予約か）
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS event_date_id uuid REFERENCES event_dates(id) ON DELETE SET NULL;
CREATE INDEX idx_reservations_event_date ON reservations(event_date_id);

-- 5. RLS for event_dates
ALTER TABLE event_dates ENABLE ROW LEVEL SECURITY;

-- 誰でも閲覧可能
CREATE POLICY "event_dates_select_all"
  ON event_dates FOR SELECT
  USING (true);

-- 管理者のみCUD
CREATE POLICY "event_dates_insert_admin"
  ON event_dates FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "event_dates_update_admin"
  ON event_dates FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "event_dates_delete_admin"
  ON event_dates FOR DELETE
  TO authenticated
  USING (is_admin());

-- 6. 日付ごとの確定済み参加者数取得
CREATE OR REPLACE FUNCTION get_date_confirmed_count(p_date_id uuid)
RETURNS integer AS $$
  SELECT COALESCE(SUM(participant_count), 0)::integer
  FROM reservations
  WHERE event_date_id = p_date_id AND status = 'confirmed';
$$ LANGUAGE sql STABLE;
