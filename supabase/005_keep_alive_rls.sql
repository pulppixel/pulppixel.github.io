-- anon 클라이언트에서 update만 가능하게
-- (insert/delete는 막혀있음, GitHub Actions cron은 update만 호출)

alter table keep_alive enable row level security;

create policy "allow anon update keep_alive"
  on keep_alive for update
  to anon
  using (true) with check (true);
