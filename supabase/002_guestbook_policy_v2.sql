-- insert_limit policy 재생성 (이름만 v2로 변경, 제약조건은 동일)

drop policy if exists "insert_limit" on guestbook;

create policy "insert_limit_v2" on guestbook for insert
  with check (
    char_length(message) between 1 and 200
    and char_length(nickname) between 1 and 20
  );
