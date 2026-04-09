-- =============================================================================
-- 顧客活動履歴テーブル（過去の参加記録や会話メモを手動で記録）
-- =============================================================================

CREATE TABLE customer_activities (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   uuid        NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  activity_date date        NOT NULL,
  title         text        NOT NULL,
  plan          text,
  memo          text,
  created_by    uuid        REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE customer_activities IS '顧客の活動履歴（管理者が手動で記録）';

CREATE INDEX idx_customer_activities_customer_id ON customer_activities(customer_id);
CREATE INDEX idx_customer_activities_date ON customer_activities(activity_date DESC);

CREATE TRIGGER trigger_customer_activities_updated_at
  BEFORE UPDATE ON customer_activities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE customer_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users full access to customer_activities"
  ON customer_activities
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
