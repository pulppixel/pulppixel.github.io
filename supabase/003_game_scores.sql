-- 미니게임 스코어보드 테이블 + RLS

create table if not exists game_scores (
  id bigserial primary key,
  game_id text not null check (length(game_id) between 1 and 30),
  nickname text not null check (length(nickname) between 1 and 20),
  score numeric not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_game_scores_game_score
  on game_scores (game_id, score desc);

create index if not exists idx_game_scores_created
  on game_scores (created_at desc);

alter table game_scores enable row level security;

create policy "anyone can read scores" on game_scores
  for select using (true);

create policy "anyone can insert scores" on game_scores
  for insert with check (
    length(nickname) between 1 and 20
    and length(game_id) between 1 and 30
    and score is not null
  );
