# AI Card Generation and Review Flow — Plan Brief

> Full plan: `context/changes/ai-generate-and-review/plan.md`

## What & Why

Implementacja S-01: użytkownik wkleja tekst → OpenRouter (Gemini Flash 1.5) generuje 3–10 fiszek → użytkownik akceptuje/edytuje/odrzuca każdą inline → zaakceptowane trafiają do Supabase. Eliminuje główną barierę adopcji: ręczne tworzenie kart jest za wolne, więc użytkownicy rezygnują z metody spaced repetition.

## Starting Point

Tabela `flashcards` z RLS istnieje (F-01, archived). Dashboard to pusty placeholder. Nie ma integracji z AI, modułu OpenRouter, ani strony `/generate`. Env schema zna tylko Supabase — OpenRouter wymaga nowego wpisu.

## Desired End State

Zalogowany użytkownik wchodzi na `/generate`, wkleja fragment dokumentacji technicznej i w ciągu 10 sekund widzi listę kart do przeglądu. Akceptuje te które mu odpowiadają, edytuje niedoskonałe, odrzuca nietraione — i jednym kliknięciem zapisuje zaakceptowane do swojego decku.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Streaming vs batch | Batch JSON | SSE przez workerd nieudokumentowane — infrastructure.md:83 flaguje jako unknown risk | Plan |
| AI model | google/gemini-flash-1.5 | Najszybszy/najtańszy spośród opcji, czas <5s dla typowych chunków | Plan |
| Card count | AI decyduje (3–10) | Adaptacyjne do długości tekstu; naturalniejszy wynik | Plan |
| AI output format | JSON array w treści | Łatwy Zod parse; Gemini dobrze trzyma JSON format | Plan |
| Review UX | Lista z akcjami inline | Wszystkie karty widoczne naraz, minimum kliknięć | Plan |
| Save timing | Przycisk "Save X cards" | Jeden request Supabase; użytkownik może zmienić zdanie przed zapisem | Plan |
| Error handling | Inline alert + Retry | Tekst nie jest tracony przy błędzie; użytkownik może spróbować ponownie | Plan |
| Text limits | min 50 / max 5000 znaków | Mieści się w kontekście Gemini; unika ogromnych tokenów | Plan |
| OpenRouter HTTP client | natywny fetch | Eliminuje ryzyko transitive deps naruszających workerd sandbox | Plan |
| Latency ceiling (OQ-1) | 10s / AbortController | Decyzja użytkownika 2026-06-16; rozwiązuje OQ-1 z roadmapy | Roadmap |
| Quality validation (OQ-2) | 5 próbek ręcznie | Decyzja użytkownika 2026-06-16; rozwiązuje OQ-2 z roadmapy | Roadmap |

## Scope

**In scope:**
- Nowa strona `/generate` z React island
- Moduł `src/lib/openrouter/` (types, service, tests)
- `POST /api/flashcards/generate` — wywołuje OpenRouter
- `POST /api/flashcards/batch-create` — zapisuje do Supabase
- `batchCreateFlashcards` w service layer flashcards
- `OPENROUTER_API_KEY` w env schema + config banner
- `/generate` w PROTECTED_ROUTES

**Out of scope:**
- Streaming SSE (zbyt ryzykowne dla workerd)
- Algorytm SM-2 (S-02)
- Lista/edycja kart (S-03)
- Walidacja jakości AI in-app (OQ-2 = ręczny test)
- Rate limiting

## Architecture / Approach

```
User (browser)
  → POST /api/flashcards/generate
      → generateFlashcards() [src/lib/openrouter/]
          → fetch OpenRouter API (10s timeout)
          → Zod validate output
      ← { cards: GeneratedCard[] }
  → UI review (React island)
  → POST /api/flashcards/batch-create
      → batchCreateFlashcards() [src/lib/flashcards/]
          → supabase.insert([...]) (RLS: user_id = auth.uid())
      ← { count, cards }
  → Success screen
```

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Config & Infrastructure | OPENROUTER_API_KEY w schema, /generate chroniony, baner | Brak — mechaniczne zmiany |
| 2. OpenRouter Service Layer | generateFlashcards() z testem, Zod validation, timeout | Zod schema może nie pasować do rzeczywistego outputu Gemini |
| 3. API Routes & Batch Create | /api/flashcards/generate + /batch-create + batchCreateFlashcards | Obsługa wszystkich error cases (timeout, malformed, auth) |
| 4. UI — Generate Page | Pełny React flow: idle→loading→review→save→success | Złożony state machine; edycja inline kart |

**Prerequisites:** F-01 zarchiwizowane (tabela `flashcards` istnieje); `OPENROUTER_API_KEY` dostępny lokalnie w `.dev.vars`

**Estimated effort:** ~3–4 sesje implementacji; 4 fazy

## Open Risks & Assumptions

- Gemini Flash 1.5 może zwracać JSON z markdown owijką (np. ` ```json\n...\n``` `) — Zod parse złapie to jako błąd; może wymagać strip-prefix przed parsowaniem
- Czas odpowiedzi OpenRouter dla dłuższych tekstów (5000 znaków) może zbliżać się do 10s — obserwować w testach manualnych
- `wrangler dev` (nie `npm run dev`) wymagany do lokalnego testowania — `npm run dev` używa Node.js bez workerd constraints

## Success Criteria (Summary)

- Użytkownik może wygenerować, przejrzeć i zapisać karty end-to-end przez UI
- `npm run lint` + `npm test` + `npm run build` — wszystkie przechodzą
- OQ-2: ≥ 5 próbek tekstu przetestowanych ręcznie przed mergem
