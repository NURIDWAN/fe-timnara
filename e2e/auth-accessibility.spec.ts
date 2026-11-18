import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("protected admin routes send unauthenticated visitors to login", async ({ page }) => {
  for (const path of ["/admin/payroll", "/admin/operations/visits", "/admin/operations/activities", "/admin/operations/violations", "/admin/operations/announcements", "/admin/operations/lms"]) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`/login\\?next=%2F${path.slice(1).replaceAll("/", "%2F")}`));
    await expect(page.getByText("Masuk ke workspace", { exact: true })).toBeVisible();
  }
});

test("login form has accessible names and no serious axe violations", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByLabel("Username")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByLabel("Kode tenant")).toBeVisible();

  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? ""))).toEqual([]);
});

test("invalid credentials show the API error without leaving the login page", async ({ page }) => {
  await page.route("**/api/auth/login", (route) => route.fulfill({
    status: 401,
    contentType: "application/json",
    body: JSON.stringify({ success: false, message: "Kredensial tidak valid.", data: null, meta: {}, errors: null }),
  }));

  await page.goto("/login");
  await page.getByLabel("Username").fill("qa-user");
  await page.getByLabel("Password").fill("not-a-real-password");
  await page.getByLabel("Kode tenant").fill("qa-tenant");
  await page.getByRole("button", { name: "Masuk" }).click();

  await expect(page.getByText("Kredensial tidak valid.")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});
