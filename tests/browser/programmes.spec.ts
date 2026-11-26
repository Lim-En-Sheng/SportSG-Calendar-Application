import { test, expect } from "@playwright/test";
test("Admin adds multiple dates, reuses names and locations, and edits from Programmes", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("combobox", { name: "Full name / Coach ID" })
    .selectOption("admin");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Manage programmes" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Programmes", exact: true }).click();
  await page.getByRole("button", { name: "Add programme" }).click();
  await page.getByLabel("Head coach name *", { exact: true }).fill("Maya Chen");
  await page
    .getByLabel("Programme name *", { exact: true })
    .fill("Basketball training");
  await page.getByLabel("Location *", { exact: true }).fill("Bishan Stadium");
  await page.getByLabel("Date *", { exact: true }).fill("2026-12-05");
  await page.getByRole("button", { name: "Add another date" }).click();
  await page.getByLabel("Date 2 *", { exact: true }).fill("2026-12-05");
  await page.getByRole("button", { name: "Create programme" }).click();
  await expect(page.getByRole("alert")).toContainText("different date");
  await page.getByLabel("Date 2 *", { exact: true }).fill("2026-12-12");
  await page.getByRole("button", { name: "Create programme" }).click();
  await expect(
    page.getByRole("cell", { name: "Basketball training", exact: true }),
  ).toHaveCount(2);
  const row = page.getByRole("row").filter({ hasText: "5 Dec 2026" });
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Location *", { exact: true }).fill("Yishun Stadium");
  await page.getByRole("button", { name: "Update programme" }).click();
  await expect(row).toContainText("Yishun Stadium");
  await page.reload();
  await expect(row).toContainText("Yishun Stadium");
  await page.getByRole("button", { name: "Add programme" }).click();
  await expect(page.locator("#programme-names option")).toHaveAttribute(
    "value",
    "Basketball training",
  );
  await expect(page.locator("#programme-locations option")).toHaveCount(2);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/programme-editor-mobile.png",
    fullPage: true,
  });
  expect(
    await page
      .getByRole("dialog")
      .evaluate((d) => d.scrollWidth <= d.clientWidth),
  ).toBe(true);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.goto("/");
  await page
    .getByRole("combobox", { name: "Full name / Coach ID" })
    .selectOption("c2");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.getByRole("link", { name: "Programmes", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add programme" })).toHaveCount(
    0,
  );
});
