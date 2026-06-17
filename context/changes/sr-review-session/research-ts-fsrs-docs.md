# Dokumentacja ts-fsrs dla S-02

Źródło: Context7 MCP (`/open-spaced-repetition/ts-fsrs`)
Data: 2026-06-17

> **Decyzja 2026-06-17:** użyjemy `ts-fsrs` (FSRS) zamiast SM-2. FSRS jest
> dokładniejszy i biblioteka jest aktywnie utrzymywana.

## Kompatybilność z Cloudflare Workers — wyjaśnienie

`package.json` (v5.4.1) zawiera `"engines": {"node": ">=20.0.0"}` — to wymaganie
**środowiska budowania** (rollup, tsx, vitest), nie runtime. ts-fsrs to czysta
matematyka: zero runtime dependencies, ships ESM + CJS + UMD, żadnych Node.js API
(fs, net, crypto). Działa na Cloudflare workerd bez żadnych flag.

---

## Instalacja

```bash
npm install ts-fsrs
```

> ⚠️ ts-fsrs wymaga Node.js >= 20. Cloudflare Workers (workerd) to nie Node.js —
> przed użyciem trzeba zweryfikować kompatybilność lub użyć `supermemo` / inline SM-2.

---

## Podstawowe API

### Typy i enumy

```typescript
// Stany karty
State.New
State.Learning
State.Review
State.Relearning

// Oceny użytkownika (4 poziomy)
Rating.Again  // zapomniałem
Rating.Hard   // trudne
Rating.Good   // dobrze
Rating.Easy   // łatwe
```

### Tworzenie karty i schedulera

```typescript
import { createEmptyCard, fsrs, Rating } from 'ts-fsrs'

const scheduler = fsrs()       // domyślne parametry FSRS
const card = createEmptyCard() // nowa karta, od razu due
```

### Podgląd 4 możliwych wyników przed oceną

```typescript
// Pokaż użytkownikowi kartę — preview wszystkich możliwości
const preview = scheduler.repeat(card, new Date())

// Po odpowiedzi użytkownika — zastosuj konkretną ocenę
const result = scheduler.next(card, new Date(), Rating.Good)

console.log(result.card) // zaktualizowany stan karty
console.log(result.log)  // log powtórki
```

### Zapis do bazy danych (serializacja dat)

```typescript
// afterHandler konwertuje Date → timestamp (number) przed zapisem do DB
const saved = scheduler.next(card, new Date(), Rating.Good, ({ card, log }) => ({
  card: {
    ...card,
    due: card.due.getTime(),
    last_review: card.last_review?.getTime() ?? null,
  },
  log: {
    ...log,
    due: log.due.getTime(),
    review: log.review.getTime(),
  },
}))
```

### Parametry schedulera (opcjonalne)

```typescript
import { fsrs, generatorParameters } from 'ts-fsrs'

// Pełny zestaw parametrów — do serializacji i zapisu w DB
const params = generatorParameters({
  request_retention: 0.9,   // cel retencji 90%
  maximum_interval: 36500,  // max interval ~100 lat
})
const scheduler = fsrs(params)

// Odczyt z DB
const serialized = '{"request_retention":0.9,"maximum_interval":36500}'
const scheduler2 = fsrs(JSON.parse(serialized))
```

### Retrievability (prawdopodobieństwo przypomnienia)

```typescript
import { forgetting_curve } from 'ts-fsrs'

// elapsed_days, stability, decay
const retrievability = forgetting_curve(0.5, 12, result.card.stability)
```

---

## Pola karty (Card type)

Pola obliczane przez FSRS i wymagane w bazie danych:

| Pole | Typ | Opis |
|---|---|---|
| `due` | `Date` | data następnej powtórki |
| `stability` | `number` | stabilność pamięci (FSRS-specific) |
| `difficulty` | `number` | trudność karty (FSRS-specific) |
| `elapsed_days` | `number` | dni od ostatniej powtórki |
| `scheduled_days` | `number` | zaplanowany interwał |
| `reps` | `number` | liczba powtórek |
| `lapses` | `number` | liczba pomyłek |
| `state` | `State` | New/Learning/Review/Relearning |
| `last_review` | `Date \| null` | data ostatniej powtórki |

> **Uwaga do S-02:** Schemat DB (F-01) przechowuje `easiness_factor`, `interval_days`,
> `repetitions`, `due_date` — to pola SM-2, nie FSRS. Wybór ts-fsrs wymagałby
> **migracji schematu DB** (dodanie `stability`, `difficulty`, `state`, `lapses`
> i usunięcie `easiness_factor`). To decyzja architektoniczna przed startem S-02.

---

## Przepływ sesji SR (S-02) z ts-fsrs

```typescript
import { fsrs, Rating } from 'ts-fsrs'

const scheduler = fsrs()

// 1. Pobierz karty due z Supabase (due <= now)
// 2. Dla każdej karty — wyświetl pytanie
// 3. Użytkownik ocenia (Again/Hard/Good/Easy)
// 4. Oblicz nowy stan
const result = scheduler.next(cardFromDB, new Date(), userRating, ({ card }) => ({
  card: {
    ...card,
    due: card.due.toISOString(),        // zapis jako string do Supabase
    last_review: card.last_review?.toISOString() ?? null,
  }
}))
// 5. Zapisz result.card do Supabase
// 6. Przejdź do następnej karty
```

---

## Źródła

- [ts-fsrs README](https://github.com/open-spaced-repetition/ts-fsrs/blob/main/README.md)
- [ts-fsrs packages/fsrs README](https://github.com/open-spaced-repetition/ts-fsrs/blob/main/packages/fsrs/README.md)
- [ts-fsrs docs](https://open-spaced-repetition.github.io/ts-fsrs/)
