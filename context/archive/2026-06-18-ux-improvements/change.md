---
id: ux-improvements
title: "Globalna nawigacja, lista fiszek, czyszczenie strony głównej i dashboardu"
status: archived
roadmap_id: —
created: 2026-06-18
updated: 2026-06-18
archived_at: 2026-06-18T00:00:00Z
---

# UX improvements

## Outcome

Użytkownik widzi to samo menu nawigacyjne (linki do Generuj / Fiszki / Powtórki / Dashboard) na każdej stronie aplikacji poza ekranami auth. Strona główna pokazuje tylko menu + hero z prawdziwym opisem produktu (bez przycisków logowania dla zalogowanych, bez boilerplate'owych kart o stacku). Nowa strona `/flashcards` pozwala przeglądać wszystkie zapisane fiszki. Dashboard pokazuje realne statystyki (liczba fiszek, due today) w stylu cosmic-glass.

## PRD refs

US-01 (kontekst produktu dla hero copy) — to jest praca UX/nawigacyjna, nie nowy FR.

## Prerequisites

S-01 (ai-generate-and-review) — done. S-02 (sr-review-session) — done.

## Scope note

Strona `/flashcards` jest **read-only** (bez edycji/usuwania) — to podzbiór przyszłego S-03 (manual-card-management, status: proposed w roadmapie). Pełny CRUD zostaje w S-03.
