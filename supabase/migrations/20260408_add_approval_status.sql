-- 予約ステータスに pending_approval, rejected を追加
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_status_check;
ALTER TABLE reservations ADD CONSTRAINT reservations_status_check
  CHECK (status IN ('pending_approval', 'confirmed', 'rejected', 'cancelled', 'attended', 'no_show'));

-- デフォルトを pending_approval に変更
ALTER TABLE reservations ALTER COLUMN status SET DEFAULT 'pending_approval';
