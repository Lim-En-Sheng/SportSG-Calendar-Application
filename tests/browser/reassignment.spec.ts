import { test, expect } from "@playwright/test";
import { seed } from "../../src/model";
test("AC sees current timeslots after assignment, cancellation and reassignment", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-27T01:00:00Z"));
  const data = seed();
  data.sessions.push({
    id: "reassign",
    title: "Reassignment programme",
    date: "2026-11-28",
    start: "09:00",
    end: "11:30",
    venue: "Hall",
    capacity: 20,
    needed: 2,
    level: "Beginner",
  });
  data.availability = { c2: ["2026-11-28"] };
  data.availabilitySlots = { c2: { reassign: ["09:00", "10:15"] } };
  await page.addInitScript((data) => {
    if (!localStorage.getItem("coach-calendar-v1"))
      localStorage.setItem("coach-calendar-v1", JSON.stringify(data));
  }, data);
  async function login(account: string) {
    await page.goto("/");
    await page
      .getByRole("combobox", { name: "Full name / Coach ID" })
      .selectOption(account);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
  }
  async function edit() {
    await page
      .getByRole("button", { name: "Saturday, 28 November 2026", exact: true })
      .click({ position: { x: 15, y: 15 } });
    await page.getByRole("button", { name: "Update assignments" }).click();
  }
  await login("head");
  await edit();
  await page
    .getByRole("checkbox", { name: "Ryan Coo, 09:00–10:00", exact: true })
    .check();
  await page.getByRole("button", { name: "Submit assignments" }).click();
  await login("c2");
  await page.getByRole("link", { name: "My sessions", exact: true }).click();
  await expect(page.locator(".assigned-timeslots")).toHaveText(
    "Your assigned timeslots: 09:00–10:00",
  );
  await login("head");
  await edit();
  await page
    .getByRole("checkbox", { name: "Ryan Coo, 09:00–10:00", exact: true })
    .uncheck();
  await page.getByRole("button", { name: "Submit assignments" }).click();
  await login("c2");
  await page.getByRole("link", { name: "My sessions", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Reassignment programme", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Cancelled", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Reassignment programme", exact: true }),
  ).toBeVisible();
  await login("head");
  await edit();
  await page
    .getByRole("checkbox", { name: "Ryan Coo, 10:15–11:15", exact: true })
    .check();
  await page.getByRole("button", { name: "Submit assignments" }).click();
  await login("c2");
  await page.getByRole("link", { name: "My sessions", exact: true }).click();
  await expect(page.locator(".assigned-timeslots")).toHaveText(
    "Your assigned timeslots: 10:15–11:15",
  );
  await page.getByRole("button", { name: "View details", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Assigned", { exact: true })).toBeVisible();
  await expect(
    dialog.locator("p").filter({ hasText: "Your assigned timeslots:" }),
  ).toContainText("10:15–11:15");
  await expect(dialog).not.toContainText("Cancelled");
  await expect(dialog).not.toContainText("09:00–10:00");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Cancelled", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Reassignment programme", exact: true }),
  ).toHaveCount(0);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("coach-calendar-v1")!),
  );
  expect(
    saved.assignments.filter((a: { cancelled?: boolean }) => a.cancelled),
  ).toHaveLength(1);
  expect(
    saved.assignments.filter((a: { cancelled?: boolean }) => !a.cancelled),
  ).toHaveLength(1);
});
