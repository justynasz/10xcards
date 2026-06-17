# Research: Biblioteki SM-2 dla S-02

Data: 2026-06-17 (zaktualizowane przez Exa)

## Kontekst

Roadmap S-02 wymaga algorytmu SM-2 (SuperMemo 2) off-the-shelf. Stack: Astro 6 SSR + React 19, TypeScript, Cloudflare Workers (workerd). Kluczowe ograniczenie: biblioteka musi być pure JS/TS bez Node.js-specific API, by działać na Cloudflare workerd.

Schemat `flashcards` (z F-01) przechowuje: `easiness_factor`, `interval_days`, `repetitions`, `due_date`.

---

## SM-2 — biblioteki

### `supermemo` ⭐ rekomendowane (battle-tested)
- npm: https://www.npmjs.com/package/supermemo
- Wersja: 2.0.23 (Mar 2025), 22 wersje od 2020
- Popularność: **904 downloads/tydzień**, 2 dependents
- Zależności: **0** (runtime), 12.5KB unpacked
- Formaty: ESM + CJS, TypeScript types
- Skala ocen: 0–5 (oryginalna SM-2)
- Cloudflare Workers: **tak** — pure math, no Node.js API
- API: `supermemo(item, grade) → item`
  ```ts
  import { supermemo, SuperMemoItem, SuperMemoGrade } from 'supermemo';
  // item: { interval, repetition, efactor }
  // grade: 0–5
  ```
- Uwaga: pole `efactor` (nie `easiness_factor`) i `repetition` (nie `repetitions`) — potrzebne mapowanie na schemat DB

### `@monkey-dev-vibes/spaced-repetition` — najnowszy API
- npm: https://www.npmjs.com/package/@monkey-dev-vibes/spaced-repetition
- Wersja: 0.1.0 (May 2026) — **bardzo nowy, 1 wersja, 2 downloads/tydzień**
- Zależności: **0**, ~95 linii TypeScript, 31.2KB unpacked
- Formaty: ESM + CJS, TypeScript types
- Skala ocen: 0–3 (Again/Hard/Good/Easy) — uproszczona, zgodna z Anki
- Cloudflare Workers: **tak** (explicit: "Works in browsers, Workers, Deno, and Bun")
- API czystsze: `processReview(card, rating) → card`, `createNewCard()`, `isDue(card)`
  ```ts
  // CardState: { easeFactor, interval, repetitions, nextReviewDate }
  ```
- Uwaga: nieprzetestowany w produkcji; 4-stopniowa skala zamiast oryginalnej 6-stopniowej

### `@open-spaced-repetition/sm-2`
- npm: https://www.npmjs.com/package/@open-spaced-repetition/sm-2
- Wersja: 0.2.1 (Aug 2025), z wiarygodnej org (open-spaced-repetition)
- API: `Scheduler`, `Card`, `ReviewLog` — bardziej rozbudowany
- Marked **"unstable"** w docs (semver minor = breaking change)
- Pomiń do MVP

### `@dtjv/sm-2` / `@kirklin/supermemo2`
- Ostatnie update: 2021/2023 → **stale, pomiń**

---

## FSRS — biblioteki (nowszy algorytm, poza scope MVP)

PRD/roadmap mówi SM-2 wystarczy dla MVP. FSRS to naturalna ścieżka upgrade po MVP — dokładniejszy (−22% log-loss vs SM-2), ale bardziej złożony API.

### `@squeakyrobot/fsrs`
- Zero deps, **explicit Cloudflare Workers support** (przykład w README)
- FSRS v4.5 + opcjonalnie v6, TypeScript, immutable API

### `quanta-fsrs`
- Zero deps, explicit: "Works in Cloudflare Workers and Vercel Edge"
- Używany w produkcji (quanta-study.de)

### `ts-fsrs`
- 681 stars, najbardziej aktywny — ale wymaga **Node.js >= 20**, co może być problemem na Cloudflare Workers (workerd to nie Node)

---

## Opcja bez zależności: inline SM-2

SM-2 to ~20 linii kodu (wzór zamknięty). Eliminuje zależność zewnętrzną, pełna kontrola nad API. Przy rozmiarze projektu — rozsądna alternatywa.

```ts
// cały algorytm
function computeSM2(ef: number, interval: number, reps: number, grade: 0|1|2|3|4|5) {
  const newEF = Math.max(1.3, ef + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)));
  if (grade < 3) return { ef: newEF, interval: 1, reps: 0 };
  const newInterval = reps === 0 ? 1 : reps === 1 ? 6 : Math.round(interval * ef);
  return { ef: newEF, interval: newInterval, reps: reps + 1 };
}
```

---

## Rekomendacja dla S-02

| Opcja | Plusy | Minusy |
|---|---|---|
| **`supermemo`** | battle-tested, 5 lat, 900 downloads/tydzień, zero deps | mapowanie nazw pól na schemat DB; nie explicit Workers |
| **`@monkey-dev-vibes/spaced-repetition`** | czysty API, explicit Workers, TypeScript-native, 4-stopniowa skala (lepsza UX) | tylko 1 wersja, 2 downloads/tydzień — nieprzetestowany |
| **Inline ~20 linii** | zero deps, pełna kontrola, audytowalny | do utrzymania samodzielnie |

**Wybór:** `supermemo` — sprawdzony w czasie, zero ryzyka kompatybilności z Workers (pure math). Jeśli zależy na czystszym API i native Workers mention: `@monkey-dev-vibes/spaced-repetition`, ale to ryzyko zależności od niedojrzałego pakietu.

Alternatywa bezpieczna: **inline SM-2** (~20 linii) umieszczone w `src/lib/spaced-repetition/` — eliminuje zewnętrzną zależność dla algorytmu prostego jak zamknięty wzór.

---

## Źródła (Exa)

- [supermemo - npm](https://www.npmjs.com/package/supermemo)
- [@monkey-dev-vibes/spaced-repetition - npm](https://www.npmjs.com/package/@monkey-dev-vibes/spaced-repetition)
- [open-spaced-repetition/sm-2-ts - GitHub](https://github.com/open-spaced-repetition/sm-2-ts)
- [@squeakyrobot/fsrs - npm](https://www.npmjs.com/package/@squeakyrobot/fsrs)
- [ts-fsrs docs](https://open-spaced-repetition.github.io/ts-fsrs/index.html)
- [quanta-fsrs - GitHub](https://github.com/ammmcreativetech-dot/quanta-fsrs)
