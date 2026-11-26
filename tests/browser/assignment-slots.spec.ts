import { test, expect } from "@playwright/test";
import { seed } from "../../src/model";
test("HC assigns different coaches per slot and unassigns without removing other slots", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-27T01:00:00Z"));
  const data = seed();
  data.sessions.push({
    id: "slots",
    title: "Slot programme",
    date: "2026-11-28",
    start: "09:00",
    end: "11:30",
    venue: "Hall",
    capacity: 20,
    needed: 1,
    level: "Beginner",
    headCoachName: "Alex Lim",
  });
  data.availability = { c1: ["2026-11-28"], c2: ["2026-11-28"] };
  data.availabilitySlots = {
    c1: { slots: ["09:00"] },
    c2: { slots: ["10:15"] },
  };
  await page.addInitScript(
    (data) => localStorage.setItem("coach-calendar-v1", JSON.stringify(data)),
    data,
  );
  await page.goto("/");
  await page
    .getByRole("combobox", { name: "Full name / Coach ID" })
    .selectOption("head");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page
    .getByRole("button", { name: "Saturday, 28 November 2026", exact: true })
    .click({ position: { x: 15, y: 15 } });
  await expect(
    page.getByText("Head coach: Alex Lim", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Update assignments" }).click();
  await expect(
    page.getByRole("checkbox", {
      name: "Marcus Tan, 10:15–11:15",
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .getByRole("checkbox", { name: "Marcus Tan, 09:00–10:00", exact: true })
    .check();
  await page
    .getByRole("checkbox", { name: "Ryan Coo, 10:15–11:15", exact: true })
    .check();
  await page.screenshot({
    path: "test-results/timeslot-assignment.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Submit assignments" }).click();
  const assignments = await page.evaluate(
    () => JSON.parse(localStorage.getItem("coach-calendar-v1")!).assignments,
  );
  expect(assignments).toHaveLength(2);
  expect(assignments.map((a: { slots: unknown }) => a.slots)).toEqual([
    [{ start: "09:00", end: "10:00" }],
    [{ start: "10:15", end: "11:15" }],
  ]);
  await page.getByRole("button", { name: "Update assignments" }).click();
  await expect(
    page.getByRole("checkbox", {
      name: "Marcus Tan, 09:00–10:00",
      exact: true,
    }),
  ).toBeChecked();
  await page
    .getByRole("checkbox", { name: "Ryan Coo, 10:15–11:15", exact: true })
    .uncheck();
  await page.getByRole("button", { name: "Submit assignments" }).click();
  const updated = await page.evaluate(
    () => JSON.parse(localStorage.getItem("coach-calendar-v1")!).assignments,
  );
  expect(updated[0]).toEqual(assignments[0]);
  expect(updated[1].cancelled).toBe(true);
});
