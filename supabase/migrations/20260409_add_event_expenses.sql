-- =============================================================================
-- イベント支出テーブル（収支計算用）
-- =============================================================================

CREATE TABLE event_expenses (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  amount      integer     NOT NULL DEFAULT 0,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE event_expenses IS 'イベント支出項目';

CREATE INDEX idx_event_expenses_event_id ON event_expenses(event_id, sort_order);

-- updated_atトリガー
CREATE TRIGGER trigger_event_expenses_updated_at
  BEFORE UPDATE ON event_expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE event_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_expenses_select" ON event_expenses
  FOR SELECT USING (true);

CREATE POLICY "event_expenses_insert" ON event_expenses
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid())
  );

CREATE POLICY "event_expenses_update" ON event_expenses
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid())
  );

CREATE POLICY "event_expenses_delete" ON event_expenses
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid())
  );
