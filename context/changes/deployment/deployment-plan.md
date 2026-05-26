# Plan: Pierwsze wdrożenie 10xCards na Cloudflare Workers

## Context

Projekt 10xCards ma w pełni skonfigurowany stos pod Cloudflare (`wrangler.jsonc`, `@astrojs/cloudflare`, `nodejs_compat`). Nie ma jeszcze żadnego produkcyjnego wdrożenia. Celem tego planu jest wykonanie pierwszego deploy'u ręcznie przez CLI, a następnie podpięcie automatycznego deploy'u w GitHub Actions.

---

## Krok 1 — Zmień nazwę Worker'a w `wrangler.jsonc`

Plik: `wrangler.jsonc`, linia z `"name": "10x-astro-starter"`

**Zmień na:**
```json
"name": "10xcards"
```

**Dlaczego:** Nazwa Worker'a staje się częścią URL produkcyjnego (`10xcards.<subdomain>.workers.dev`) i nazwy zasobu w dashboardzie Cloudflare. `10x-astro-starter` to domyślna nazwa startera, nie nazwa produktu.

---

## Krok 2 — Zaloguj się do Cloudflare CLI

```bash
npx wrangler login
```

Otwiera przeglądarkę z OAuth. Po zatwierdzeniu token jest zapisany lokalnie w `~/.wrangler/config/`.

> **Gate ręczny:** Wymaga konta Cloudflare z uprawnieniami do Workers.

---

## Krok 3 — Ustaw sekrety produkcyjne

```bash
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_KEY
```

Każda komenda pyta interaktywnie o wartość. Wartości pochodzą z dashboardu Supabase (Settings → API).

**Weryfikacja:** `npx wrangler secret list` — powinny być widoczne `SUPABASE_URL` i `SUPABASE_KEY`.

---

## Krok 4 — Zbuduj i wdróż

```bash
npm run build
npx wrangler deploy
```

`npm run build` generuje `./dist/`. `wrangler deploy` pakuje Worker + assets i wysyła do Cloudflare.

Oczekiwany output końcowy:
```
Deployed 10xcards triggers (1)
  https://10xcards.<account>.workers.dev
```

---

## Krok 5 — Weryfikacja po wdrożeniu

1. Otwórz URL z outputu w przeglądarce — powinna załadować się strona (lub baner "missing config" jeśli sekrety nie dotarły jeszcze).
2. Sprawdź logi na żywo:
   ```bash
   npx wrangler tail 10xcards --format pretty
   ```
3. Spróbuj zalogować się przez `/auth/signin` — weryfikuje połączenie z Supabase.

---

## Krok 6 — Dodaj deploy do GitHub Actions

Plik: `.github/workflows/ci.yml`

Dodaj job `deploy` uruchamiany tylko po `push` na `master` (nie na PR):

```yaml
deploy:
  needs: ci
  runs-on: ubuntu-latest
  if: github.event_name == 'push' && github.ref == 'refs/heads/master'
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 22
        cache: npm
    - run: npm ci
    - run: npm run build
      env:
        SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
        SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
    - name: Deploy to Cloudflare Workers
      run: npx wrangler deploy
      env:
        CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

> **Gate ręczny:** Przed push'em na master trzeba:
> 1. Wygenerować API token Cloudflare (Dashboard → My Profile → API Tokens → Create Token → "Edit Cloudflare Workers" template, ogranicz do jednego konta).
> 2. Dodać go jako `CLOUDFLARE_API_TOKEN` w GitHub repository secrets (Settings → Secrets and variables → Actions).

---

## Krok 7 — Popraw `npm run dev` (lokalny paritet z workerd)

Plik: `package.json`, skrypt `"dev"`

**Zmień z** `astro dev` (Node.js runtime)
**Na** `wrangler dev` (workerd runtime)

Eliminuje klasę błędów "działa lokalnie, pada na produkcji" spowodowaną różnicami między Node.js a workerd. Opisane jako High-likelihood risk w `infrastructure.md`.

---

## Operacje poza zakresem agenta (wymagają ręcznego działania)

| Czynność | Gdzie |
|---|---|
| Stworzenie konta Cloudflare | cloudflare.com |
| Pobranie `SUPABASE_URL` i `SUPABASE_KEY` | Supabase Dashboard → Settings → API |
| Wygenerowanie `CLOUDFLARE_API_TOKEN` | Cloudflare Dashboard → My Profile → API Tokens |
| Dodanie `CLOUDFLARE_API_TOKEN` do GitHub Secrets | GitHub repo → Settings → Secrets |

---

## Weryfikacja end-to-end

- [x] `https://10xcards.<account>.workers.dev` ładuje stronę główną
- [x] `/auth/signin` wyświetla formularz (brak błędów konsoli)
- [x] `npx wrangler tail` pokazuje logi requestów
- [x] Push na `master` w GitHub triggeruje job `deploy` i kończy się zielonym statusem
- [x] `npx wrangler secret list` zwraca `SUPABASE_URL` i `SUPABASE_KEY`

---

## Status

**Wdrożone:** 2026-05-26  
**Platforma:** Cloudflare Workers  
**URL:** `https://10xcards.justynaszczygiel.workers.dev`  
**Version ID:** `f17b7f9c-494c-4825-b4bc-9bc760a4388f`
