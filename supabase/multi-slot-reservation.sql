-- 予約時に複数の日時/スロットを選択可能にする設定
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS allow_multi_slot_reservation BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN events.allow_multi_slot_reservation IS 'trueの場合、予約時に複数の日時/時間帯を選択できる';
