-- =============================================================================
-- 時間割予約機能 マイグレーション
-- =============================================================================

-- 1. events テーブルにカラム追加
ALTER TABLE events ADD COLUMN IF NOT EXISTS use_time_slots boolean NOT NULL DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS slot_interval_minutes integer NOT NULL DEFAULT 30;
ALTER TABLE events ADD COLUMN IF NOT EXISTS slot_capacity integer NOT NULL DEFAULT 1;

-- slot_interval_minutes のチェック制約（15, 30, 45, 60, 90, 120 分のいずれか）
ALTER TABLE events ADD CONSTRAINT events_slot_interval_check
  CHECK (slot_interval_minutes IN (15, 30, 45, 60, 90, 120));

-- 2. event_time_slots テーブル作成
CREATE TABLE event_time_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  start_time time NOT NULL,
  end_time time NOT NULL,
  capacity integer NOT NULL DEFAULT 1,
  is_available boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- インデックス
CREATE INDEX idx_event_time_slots_event_id ON event_time_slots(event_id, sort_order);
CREATE INDEX idx_event_time_slots_available ON event_time_slots(event_id, is_available);

-- コメント
COMMENT ON TABLE event_time_slots IS '時間割スロット';
COMMENT ON COLUMN events.use_time_slots IS '時間割予約を使用するかどうか';
COMMENT ON COLUMN events.slot_interval_minutes IS 'スロットの時間間隔（分）';
COMMENT ON COLUMN events.slot_capacity IS 'スロットごとのデフォルト定員';

-- 3. reservations テーブルにカラム追加
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS time_slot_id uuid REFERENCES event_time_slots(id) ON DELETE SET NULL;
CREATE INDEX idx_reservations_time_slot ON reservations(time_slot_id);

-- 4. RLS
ALTER TABLE event_time_slots ENABLE ROW LEVEL SECURITY;

-- 誰でも閲覧可能（予約フォームで表示するため）
CREATE POLICY "time_slots_select_all"
  ON event_time_slots FOR SELECT
  USING (true);

-- 管理者のみ作成・更新・削除可能
CREATE POLICY "time_slots_insert_admin"
  ON event_time_slots FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "time_slots_update_admin"
  ON event_time_slots FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "time_slots_delete_admin"
  ON event_time_slots FOR DELETE
  TO authenticated
  USING (is_admin());

-- 5. スロットごとの確定済み参加者数取得関数
CREATE OR REPLACE FUNCTION get_slot_confirmed_count(p_slot_id uuid)
RETURNS integer AS $$
  SELECT COALESCE(SUM(participant_count), 0)::integer
  FROM reservations
  WHERE time_slot_id = p_slot_id AND status = 'confirmed';
$$ LANGUAGE sql STABLE;
