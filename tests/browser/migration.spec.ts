import { test, expect } from "@playwright/test";
import { seed } from "../fixture";
test("existing browser demo data is cleaned on load and stays cleaned after refresh", async ({ page }) => {
  const legacy = seed();
  delete legacy.legacyDemoRemoved;
  await page.addInitScript((state) => {
    if (!localStorage.getItem("coach-calendar-v1")) localStorage.setItem("coach-calendar-v1", JSON.stringify(state));
  }, legacy);
  await page.goto("/");
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("coach-calendar-v1")!));
  expect(saved.sessions).toEqual([]);
  expect(saved.assignments).toEqual([]);
  expect(saved.availability.c2).toEqual([]);
  expect(saved.legacyDemoRemoved).toBe(true);
  await page.reload();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("coach-calendar-v1")!).sessions)).toEqual([]);
});
