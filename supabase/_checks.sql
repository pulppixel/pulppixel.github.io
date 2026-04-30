-- RLS / policy 적용 확인용 쿼리 모음
-- migration이 아니라 점검용. schema 변경 없음.

-- 1. 모든 policy 확인
select schemaname, tablename, policyname, cmd, qual, with_check
from pg_policies
where tablename in ('guestbook', 'game_scores', 'keep_alive');

-- 2. RLS 활성화 상태 확인
select schemaname, tablename, rowsecurity
from pg_tables
where tablename in ('guestbook', 'game_scores', 'keep_alive');

-- 3. keep_alive 현재 상태
select * from keep_alive;
