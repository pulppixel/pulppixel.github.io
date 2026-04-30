-- Supabase 60일 inactivity sleep 방지용 ping 테이블
-- GitHub Actions cron(Mon/Thu 09:00 UTC)에서 PATCH 호출

create table if not exists keep_alive (
  id int primary key,
  pinged_at timestamptz default now()
);

insert into keep_alive (id, pinged_at) values (1, now())
  on conflict (id) do nothing;
