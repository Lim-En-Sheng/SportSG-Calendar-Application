import { test, expect } from "@playwright/test";

test("live Singapore clock overrides old demo preferences and drives default dates", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-25T16:05:00Z"));
  await page.addInitScript(() => !sessionStorage.getItem("coach-calendar-view") && sessionStorage.setItem("coach-calendar-view", JSON.stringify({ role: "Head Coach", coachId: "c2", demo: true })));
  await page.goto("/");
  await page.getByRole("combobox", { name: "Full name / Coach ID" }).selectOption("head");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "November 2026", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Thursday, 26 November 2026", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("footer")).toContainText("2026-11-26 00:05");
  await page.clock.setFixedTime(new Date("2026-11-25T16:06:00Z"));
  await expect(page.locator("footer")).toContainText("2026-11-26 00:06");
  await page.goto("/");
  await page.getByRole("combobox", { name: "Full name / Coach ID" }).selectOption("c2");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.goto("/timesheet");
  await expect(page.locator('input[type="month"]')).toHaveValue("2026-11");
  await page.goto("/");
  await page.getByRole("combobox", { name: "Full name / Coach ID" }).selectOption("admin");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.goto("/reports");
  await expect(page.locator('input[type="month"]')).toHaveValue("2026-11");
});

