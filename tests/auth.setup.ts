import { test, expect } from "@playwright/test";

const E2E_TEST_EMAIL = process.env.E2E_TEST_EMAIL;
const E2E_TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;

test("login", async ({ page }) => {
  if (!E2E_TEST_EMAIL || !E2E_TEST_PASSWORD) {
    throw new Error(
      "E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set. Set them in .dev.vars locally, or as CI env vars — " +
        "use a dedicated test account, never a real user's credentials.",
    );
  }

  await page.goto("/auth/signin");

  // React 19 controlled inputs: użyj pressSequentially zamiast fill()
  // fill() ustawia wartość DOM ale nie zawsze triggeruje React synthetic events
  const emailInput = page.getByRole("textbox", { name: "Email" });
  await emailInput.click();
  await emailInput.pressSequentially(E2E_TEST_EMAIL);
  await expect(emailInput).toHaveValue(E2E_TEST_EMAIL);

  // Password input: locator po id bo type="password" może być pomijany przez getByRole
  const passwordInput = page.locator("#password");
  await passwordInput.click();
  await passwordInput.pressSequentially(E2E_TEST_PASSWORD);
  await expect(passwordInput).toHaveValue(E2E_TEST_PASSWORD);

  await page.getByRole("button", { name: "Zaloguj się" }).click();

  // Poczekaj aż opuścimy stronę logowania — session cookie dostępne po redirect
  await page.waitForURL((url) => !url.pathname.startsWith("/auth"));

  await page.context().storageState({
    path: "playwright/.auth/user.json",
  });
});
