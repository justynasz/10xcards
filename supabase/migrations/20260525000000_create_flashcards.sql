create table if not exists public.flashcards (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users (id) on delete cascade,
  front      text        not null,
  back       text        not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.flashcards enable row level security;

create policy "flashcards: select own"
  on public.flashcards for select
  to authenticated
  using (user_id = auth.uid());

create policy "flashcards: insert own"
  on public.flashcards for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "flashcards: update own"
  on public.flashcards for update
  to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "flashcards: delete own"
  on public.flashcards for delete
  to authenticated
  using (user_id = auth.uid());

create or replace function public.set_updated_at()
  returns trigger
  language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_flashcards_updated_at
  before update on public.flashcards
  for each row execute function public.set_updated_at();
