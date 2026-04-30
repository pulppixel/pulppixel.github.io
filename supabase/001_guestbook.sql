-- guestbook 테이블 + RLS
-- public read, insert만 허용 (length 제한)

create table guestbook (
  id bigint generated always as identity primary key,
  nickname text not null default 'anonymous',
  message text not null,
  created_at timestamptz default now()
);

alter table guestbook enable row level security;

create policy "read_all" on guestbook for select
  using (true);

create policy "insert_limit" on guestbook for insert
  with check (
    char_length(message) between 1 and 200
    and char_length(nickname) between 1 and 20
  );
