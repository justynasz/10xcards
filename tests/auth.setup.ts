import { test, expect } from "@playwright/test";

test("login", async ({ page }) => {
  await page.goto("/auth/signin");

  // React 19 controlled inputs: użyj pressSequentially zamiast fill()
  // fill() ustawia wartość DOM ale nie zawsze triggeruje React synthetic events
  const emailInput = page.getByRole("textbox", { name: "Email" });
  await emailInput.click();
  await emailInput.pressSequentially("pejustyna@gmail.com");
  await expect(emailInput).toHaveValue("pejustyna@gmail.com");

  // Password input: locator po id bo type="password" może być pomijany przez getByRole
  const passwordInput = page.locator("#password");
  await passwordInput.click();
  await passwordInput.pressSequentially("Test123!");
  await expect(passwordInput).toHaveValue("Test123!");

  await page.getByRole("button", { name: "Zaloguj się" }).click();

  // Poczekaj aż opuścimy stronę logowania — session cookie dostępne po redirect
  await page.waitForURL((url) => !url.pathname.startsWith("/auth"));

  await page.context().storageState({
    path: "playwright/.auth/user.json",
  });
});
