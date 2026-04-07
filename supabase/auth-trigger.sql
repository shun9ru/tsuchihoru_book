-- =============================================================================
-- Auth ユーザー作成時に public.users テーブルへ自動挿入するトリガー
-- =============================================================================
-- Supabase の auth.users にユーザーが作成されたとき、
-- public.users にも対応するレコードを自動的に作成する。

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, role, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    'admin',  -- Phase 1 ではすべての認証ユーザーを管理者として扱う
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- トリガーを設定（既存のトリガーがあれば置き換え）
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- 既存ユーザーの手動登録
-- =============================================================================
-- すでに auth.users にいるが public.users にいないユーザーを一括登録
INSERT INTO public.users (id, email, role, display_name)
SELECT id, email, 'admin', COALESCE(raw_user_meta_data->>'display_name', email)
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.users)
ON CONFLICT (id) DO NOTHING;
