/**
 * Risk: R2 — Cichy błąd batch-save
 * Seed: tests/seed.spec.ts
 * Ochrona: gdy batch-create zwraca błąd, GenerateView musi pokazać stan błędu —
 *           NIE sukces i NIE milczeć. Użytkownik nie może stracić zaakceptowanych kart
 *           bez wiedzy o błędzie.
 */
import { test, expect } from "@playwright/test";

test.use({
  storageState: "playwright/.auth/user.json",
});

test("batch-save błąd pokazuje stan błędu, nie cichy sukces (ryzyko R2)", async ({ page }) => {
  // Mock generowania — deterministyczne karty, brak zależności od OpenRouter
  await page.route("**/api/flashcards/generate", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        cards: [
          { front: "Pytanie testowe R2?", back: "Odpowiedź testowa R2." },
          { front: "Drugie pytanie R2?", back: "Druga odpowiedź R2." },
        ],
      }),
    }),
  );

  await page.goto("/generate");

  // React 19 controlled textarea: fill() nie triggeruje onChange → użyj pressSequentially
  // (ten sam wzorzec co auth.setup.ts dla email/password)
  const textarea = page.getByRole("textbox", { name: /wklej tekst/i });
  await textarea.click();
  await textarea.pressSequentially(
    "Tekst do wygenerowania fiszek testowych. Musi miec co najmniej piecdziesiat znakow.",
  );
  await expect(textarea).toHaveValue(
    "Tekst do wygenerowania fiszek testowych. Musi miec co najmniej piecdziesiat znakow.",
  );
  await expect(page.getByText(/brakuje jeszcze/i)).toBeHidden();

  await page.getByRole("button", { name: "Generuj fiszki" }).click();
  await expect(page.getByRole("heading", { name: "Przejrzyj fiszki" })).toBeVisible();

  // Zaakceptuj pierwszą kartę
  await page.getByRole("button", { name: "Akceptuj" }).first().click();
  await expect(page.getByText("✓ Zaakceptowano")).toBeVisible();

  // Mock zapisu — serwer zwraca błąd 500
  await page.route("**/api/flashcards/batch-create", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "Błąd serwera" }),
    }),
  );

  await page.getByRole("button", { name: /Zapisz/ }).click();

  // R2: musi pojawić się przycisk retry — stan błędu, nie sukces
  await expect(page.getByRole("button", { name: "Spróbuj ponownie" })).toBeVisible();

  // R2: stan sukcesu NIE może być widoczny
  await expect(page.getByText(/Dodano.*talii/)).not.toBeVisible();
});
