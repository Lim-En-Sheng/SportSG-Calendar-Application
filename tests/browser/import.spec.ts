import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import writeExcel from "write-excel-file/universal";

test("Excel import accepts serial dates and times, and template excludes examples", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-26T04:00:00Z"));
  await page.goto("/");
  await page
    .getByRole("combobox", { name: "Full name / Coach ID" })
    .selectOption("admin");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.getByRole("link", { name: "Programmes", exact: true }).click();
  await page
    .getByRole("button", { name: "Import programmes", exact: true })
    .click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Excel template" }).click();
  const template = await download;
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: template.suggestedFilename(),
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: readFileSync((await template.path())!),
    });
  await expect(page.getByRole("alert")).toContainText("No programmes found");
  const blob = await writeExcel([
    [
      "title",
      "date",
      "start",
      "end",
      "venue",
      "capacity",
      "needed",
      "level",
    ].map((value) => ({ value })),
    [
      "Long programme title for testing calendar ellipsis and layout",
      46357,
      0.375,
      0.52083333333333337,
      "Bishan Stadium",
      20,
      2,
      "Beginner",
    ].map((value) => ({ value })),
    [
      "Second programme",
      46357,
      0.5416666666666666,
      0.6875,
      "Bishan Stadium",
      25,
      3,
      "Intermediate",
    ].map((value) => ({ value })),
  ]).toBlob();
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "programmes.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from(await blob.arrayBuffer()),
    });
  await expect(
    page.getByRole("cell", { name: "09:00 - 12:30", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Import 2 programmes", exact: true })
    .click();
  await expect(
    page.getByText("Import complete", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("link", { name: "Calendar", exact: true }).click();
  // Imported fixture is December 2026.
  await page.getByRole("button", { name: "Next month" }).click();
  const link = page.getByTitle(
    "Long programme title for testing calendar ellipsis and layout",
  );
  await expect(link).toBeVisible();
  expect(await link.evaluate((el) => getComputedStyle(el).textOverflow)).toBe(
    "ellipsis",
  );
  expect(await link.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(
    true,
  );
  const cell = link.locator("..").locator("..");
  expect(
    await cell
      .locator("strong")
      .evaluate((el) => getComputedStyle(el).borderBottomRightRadius),
  ).toBe("12px");
  await page.screenshot({
    path: "test-results/calendar-corners.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(link).toBeVisible();
  await page.screenshot({
    path: "test-results/calendar-corners-mobile.png",
    fullPage: true,
  });
});
