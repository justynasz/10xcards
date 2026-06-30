import { test, expect } from "@playwright/test";

test.use({
  storageState: "playwright/.auth/user.json",
});

test("generate flashcards from text (risk: AI generation failure)", async ({ page }) => {
  await page.goto("/generate");

  console.log(page.url());

  await expect(page.getByRole("heading", { name: "Generuj fiszki" })).toBeVisible();

  const input = page.getByRole("textbox", {
    name: /wklej tekst/i,
  });

  await input.fill("E2E test content for flashcards generation. This is long enough to pass validation.");

  await expect(page.getByText(/brakuje jeszcze/i)).toBeHidden();

  await page.getByRole("button", { name: "Generuj fiszki" }).click();

  await expect(page.getByRole("heading", { name: "Przejrzyj fiszki" })).toBeVisible();

  await expect(page.getByRole("button", { name: "Zapisz 0 fiszek" })).toBeVisible();
});
