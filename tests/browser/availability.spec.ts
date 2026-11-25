import { test, expect } from "@playwright/test";
test("availability submission is yellow, persistent and separate for each month and coach", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-25T06:00:00Z"));
  await page.goto("/");
  await page
    .getByRole("combobox", { name: "Full name / Coach ID" })
    .selectOption("c2");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  const nov = page.getByRole("button", {
    name: "Thursday, 26 November 2026",
    exact: true,
  });
  await nov.click();
  await page.getByRole("button", { name: "Next month" }).click();
  await page
    .getByRole("button", { name: "Saturday, 5 December 2026", exact: true })
    .click();
  await page.getByRole("button", { name: "Previous month" }).click();
  await page.getByRole("button", { name: "Submit availability" }).click();
  await expect(page.locator(".availability-summary")).toContainText("Pending");
  await expect(nov).toHaveCSS("background-color", "rgb(254, 243, 199)");
  await expect(page.locator(".availability-summary")).toHaveCSS(
    "background-color",
    "rgb(254, 243, 199)",
  );
  let saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("coach-calendar-v1")!),
  );
  expect(saved.availability.c2).not.toContain("2026-12-05");
  await page.getByRole("button", { name: "Next month" }).click();
  await expect(
    page.getByRole("button", { name: "Submit availability" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Submit availability" }).click();
  await page.reload();
  await expect(page.locator(".availability-summary")).toContainText("Pending");
  await page.getByRole("button", { name: "Update availability" }).click();
  await nov.click();
  await page.getByRole("button", { name: "Cancel update" }).click();
  await expect(nov).toHaveCSS("background-color", "rgb(254, 243, 199)");
  await page.screenshot({
    path: "test-results/availability-pending.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.screenshot({
    path: "test-results/availability-pending-mobile.png",
    fullPage: true,
  });
  saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("coach-calendar-v1")!),
  );
  expect(saved.availability.c2).toContain("2026-12-05");
  expect(Object.keys(saved.availabilitySubmissions.c2)).toEqual([
    "2026-11",
    "2026-12",
  ]);
  await page.getByRole("button", { name: "Update availability" }).click();
  await nov.click();
  await page.getByRole("button", { name: "Submit availability" }).click();
  await expect(page.getByRole("heading", { name: "Select dates available" })).toBeVisible();
  await expect(page.locator(".availability-pending")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Select dates available" })).toBeVisible();
  await page.getByRole("button", { name: "Submit availability" }).click();
  await expect(page.locator(".availability-pending")).toHaveCount(0);
  await page.getByRole("button", { name: "Next month" }).click();
  await expect(page.locator(".availability-summary")).toContainText("Pending");
  await page.goto("/");
  await page
    .getByRole("combobox", { name: "Full name / Coach ID" })
    .selectOption("c1");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Submit availability" }),
  ).toBeVisible();
});
import { seed } from "../../src/model";
test("availability toggles yellow and white and turns green only after deployment", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-25T06:00:00Z"));
  const state = seed();
  state.sessions.push({ id: "test-session", title: "Coaching", date: "2026-11-26", start: "09:00", end: "10:00", venue: "Sports Hall", capacity: 20, needed: 3, level: "Beginner" });
  await page.addInitScript((state) => { if (!localStorage.getItem("coach-calendar-v1")) localStorage.setItem("coach-calendar-v1", JSON.stringify(state)); }, state);
  const login = async (id: string) => {
    await page.goto("/");
    await page.getByRole("combobox", { name: "Full name / Coach ID" }).selectOption(id);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
  };
  await login("c2");
  await expect(page.getByRole("button", { name: "Tuesday, 24 November 2026", exact: true })).toBeDisabled();
  const day = page.getByRole("button", { name: "Thursday, 26 November 2026", exact: true });
  await day.click();
  await expect(day).toHaveCSS("background-color", "rgb(254, 243, 199)");
  await page.getByRole("button", { name: "Submit availability" }).click();
  await page.reload();
  await expect(day).toHaveCSS("background-color", "rgb(254, 243, 199)");
  await page.getByRole("button", { name: "Update availability" }).click();
  await day.click();
  await expect(day).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(day).toHaveAttribute("aria-pressed", "false");
  await day.click();
  await page.getByRole("button", { name: "Submit availability" }).click();
  await login("head");
  await day.click();
  await page.getByRole("button", { name: "Update assignments" }).click();
  await page.getByRole("checkbox", { name: "Ryan Coo", exact: true }).check();
  await page.getByRole("button", { name: "Submit assignments" }).click();
  await login("c2");
  await expect(day).toHaveCSS("background-color", "rgb(220, 252, 231)");
});
