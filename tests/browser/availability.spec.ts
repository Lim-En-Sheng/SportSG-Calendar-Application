import { test, expect } from "@playwright/test";
import { seed } from "../../src/model";

test("programme availability uses hourly slots and confirmed links open My sessions", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-25T06:00:00Z"));
  const state = seed();
  state.sessions.push({
    id: "p1",
    title: "Basketball",
    date: "2026-11-26",
    start: "09:00",
    end: "11:30",
    venue: "Hall",
    capacity: 20,
    needed: 3,
    level: "Beginner",
  });
  await page.addInitScript((state) => {
    if (!localStorage.getItem("coach-calendar-v1"))
      localStorage.setItem("coach-calendar-v1", JSON.stringify(state));
  }, state);
  async function login(id: string) {
    await page.goto("/");
    await page
      .getByRole("combobox", { name: "Full name / Coach ID" })
      .selectOption(id);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
  }
  await login("c2");
  await expect(
    page.getByRole("link", { name: "Coaches", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: "Wednesday, 25 November 2026",
      exact: true,
    }),
  ).toBeDisabled();
  const day = page.getByRole("button", {
    name: "Thursday, 26 November 2026",
    exact: true,
  });
  await day.click();
  const dialog = page.getByRole("dialog");
  // New blocks with 15-min breaks: 09:00-10:00, 10:15-11:15
  await expect(dialog.getByRole("checkbox")).toHaveCount(3); // Tick all + 2 blocks
  await dialog.getByRole("checkbox", { name: "Tick all" }).check();
  await dialog
    .getByRole("checkbox", { name: "09:00–10:00", exact: true })
    .uncheck();
  await dialog.getByRole("button", { name: "Save time slots" }).click();
  await expect(day).toHaveCSS("background-color", "rgb(254, 243, 199)");
  await page.getByRole("button", { name: "Submit availability" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Update availability" }).click();
  await day.click();
  await expect(
    dialog.getByRole("checkbox", { name: "09:00–10:00", exact: true }),
  ).not.toBeChecked();
  await expect(
    dialog.getByRole("checkbox", { name: "10:15–11:15", exact: true }),
  ).toBeChecked();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Cancel update" }).click();
  await page
    .locator(".daily-panel")
    .getByRole("link", { name: "Basketball", exact: true })
    .click();
  await expect(page).toHaveURL(/sessions\?session=p1/);
  await expect(
    page.getByRole("heading", { name: "Basketball", exact: true }),
  ).toBeVisible();
  await login("head");
  await day.click();
  await page.getByRole("button", { name: "Update assignments" }).click();
  await page.getByRole("checkbox", { name: "Ryan Coo", exact: true }).check();
  await expect(
    page.getByRole("checkbox", { name: "09:00–10:00", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Submit assignments" }).click();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("coach-calendar-v1")!),
  );
  expect(saved.assignments[0].slots).toEqual([
    { start: "10:15", end: "11:15" },
  ]);
  await login("c2");
  await day.dblclick();
  await expect(page).toHaveURL(/sessions\?date=2026-11-26/);
  await expect(
    page.getByRole("heading", { name: "Basketball", exact: true }),
  ).toBeVisible();
});
