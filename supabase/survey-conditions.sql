-- 条件分岐アンケート対応
ALTER TABLE survey_questions
  ADD COLUMN IF NOT EXISTS parent_question_id UUID REFERENCES survey_questions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS condition_value TEXT;

COMMENT ON COLUMN survey_questions.parent_question_id IS '条件分岐の親設問ID（NULLなら常時表示）';
COMMENT ON COLUMN survey_questions.condition_value IS '親設問でこの値が選択された場合に表示';
