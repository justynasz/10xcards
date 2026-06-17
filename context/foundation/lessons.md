# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Migracje Supabase z DDL destruktywnym muszą być opakowane w transakcję

- **Context**: Supabase migrations (`supabase/migrations/*.sql`)
- **Problem**: `DROP COLUMN` + `ADD COLUMN` bez transakcji — jeśli `ADD COLUMN` zawiedzie po wykonaniu `DROP`, tabela jest w niesprawnym stanie bez możliwości rollbacku.
- **Rule**: Zawsze owijaj DDL z destruktywnymi operacjami (`DROP COLUMN`, `RENAME COLUMN`) w `BEGIN; ... COMMIT;`.
- **Applies to**: Wszystkie migracje Supabase zawierające `DROP` lub `RENAME`.
