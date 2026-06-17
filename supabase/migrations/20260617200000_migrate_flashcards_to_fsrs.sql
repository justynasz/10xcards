begin;

alter table public.flashcards
  drop column easiness_factor,
  drop column interval_days,
  drop column repetitions,
  add column stability      numeric     not null default 0,
  add column difficulty     numeric     not null default 0,
  add column elapsed_days   int         not null default 0,
  add column scheduled_days int         not null default 0,
  add column reps           int         not null default 0,
  add column lapses         int         not null default 0,
  add column state          int         not null default 0,
  add column last_review    timestamptz          default null;

commit;
