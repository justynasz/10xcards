<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: R2/R3 Error-Path Tests

- **Plan**: context/changes/testing-r2-r3-error-paths/plan.md
- **Scope**: All Phases (1–3)
- **Date**: 2026-06-30
- **Verdict**: APPROVED
- **Findings**: 0 critical | 1 warning (F1–F2) | 2 observations (F3–F4)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING — benign adaptation (docblock vs config glob) |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING — no afterEach in route test files |
| Success Criteria | PASS — 34/34 tests green, 0 lint errors |

## Success Criteria Verification

- `npm test` → 34 passed (7 test files) ✅
- `npm run lint` → 0 errors, 1 pre-existing warning in unrelated file ✅

## False Positives Dismissed

The following agent findings were dismissed as contradicted by explicit plan decisions:
- "Brak testu 401 w generate.test.ts" → plan: "Not testing `generate.ts` auth guard — same mechanism as `batch-create.ts`; one proof is enough"
- "toContain zamiast toBe" → plan: "Error messages asserted with `.toContain(...)` not strict equality — protects against minor wording changes"
- "null createClient path untested" → plan scope: "throw-from-service path (line 38-42)" — null-guard explicitly excluded

## Findings

### F1 — vitest.config.ts: environmentMatchGlobs zastąpiony docblockiem

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix jest oczywisty i wąski
- **Dimension**: Plan Adherence
- **Location**: vitest.config.ts (brak), GenerateView.test.tsx:1
- **Detail**: Plan wymagał `environmentMatchGlobs: [["src/components/**", "jsdom"]]`. Adaptacja była konieczna — glob nie matchował pełnej ścieżki w vitest 4. Zamiast tego użyto `// @vitest-environment jsdom` docblock w pliku testowym. Efekt identyczny, ale przyszłe pliki komponentów muszą dodać docblock ręcznie.
- **Fix**: Zaktualizować "Critical Implementation Details" w plan.md by odnotować odkrycie. Opcjonalnie sprawdzić `**/src/components/**` jako glob.
- **Decision**: FIXED — zaktualizowano "Critical Implementation Details" w plan.md

### F2 — GenerateView.test.tsx: brak asercji enabled przed kliknięciem

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix jest oczywisty i wąski
- **Dimension**: Safety & Quality
- **Location**: src/components/generate/__tests__/GenerateView.test.tsx:29
- **Detail**: Test używa dokładnie MIN_CHARS (50) znaków i klika bez sprawdzenia czy przycisk jest enabled. Jeśli MIN_CHARS zostanie zmieniony, klik milczy i test kończy się niezrozumiałym timeoutem.
- **Fix**: Dodać `expect(screen.getByRole("button", { name: /Generuj fiszki/i })).not.toBeDisabled()` przed klikiem.
- **Decision**: FIXED — dodano `btn.disabled === false` asercję + `cleanup()` w afterEach

### F3 — Brak afterEach mock cleanup w route test files

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix jest oczywisty i wąski
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/flashcards/__tests__/generate.test.ts, batch-create.test.ts
- **Detail**: Brak `afterEach` w obu plikach; openrouter.test.ts jako wzorzec referencyjny używa `afterEach(() => { vi.unstubAllGlobals(); })`. Ryzyko wycieku mockResolvedValueOnce jest niskie przy 2 testach, ale drobna niespójność.
- **Fix**: Dodać `afterEach(() => { vi.clearAllMocks(); })` w obu plikach.
- **Decision**: FIXED — dodano `afterEach(() => { vi.clearAllMocks(); })` w generate.test.ts i batch-create.test.ts

### F4 — R3 test: asercja braku "Przejrzyj fiszki" ma słaby sygnał

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix jest oczywisty i wąski
- **Dimension**: Safety & Quality
- **Location**: src/components/generate/__tests__/GenerateView.test.tsx:34
- **Detail**: `queryByText(/Przejrzyj fiszki/i)` jest null zarówno w idle jak i w error state — tekst ten nigdy nie był wyrenderowany w trakcie testu R3. Realnym guardem jest `findByText(/Generowanie nie powiodło się/i)`. Asercja braku jest poprawna technicznie ale redundantna.
- **Fix**: Można pozostawić. Opcjonalnie zastąpić bardziej specyficzną asercją.
- **Decision**: SKIPPED — asercja poprawna i harmless; findByText na błędzie jest realnym guardem
