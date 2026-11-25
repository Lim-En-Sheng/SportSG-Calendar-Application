import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { seed } from "../fixture";

async function role(page: Page, name: string) {
  await page.getByRole("button", { name: "Open profile" }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  const account =
    name === "Head Coach"
      ? "Maya Chen"
      : name === "Assistant Coach"
        ? "Ryan Coo"
        : "Admin";
  await page
    .getByRole("combobox", { name: "Full name / Coach ID" })
    .selectOption(
      account === "Maya Chen"
        ? "head"
        : account === "Ryan Coo"
          ? "c2"
          : "admin",
    );
  await page.getByRole("button", { name: "Log in", exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((fixture) => {
    if (!localStorage.getItem("coach-calendar-v1"))
      localStorage.setItem("coach-calendar-v1", JSON.stringify(fixture));
  }, seed());
  await page.clock.setFixedTime(new Date("2026-09-20T06:00:00Z"));
  await page.goto("/");
  await page
    .getByRole("combobox", { name: "Full name / Coach ID" })
    .selectOption("head");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
});

test("Figma calendar layout, editable assignments and month navigation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/calendar");
  await page
    .getByRole("button", { name: "Saturday, 19 September 2026", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Deploy your coaching team" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Assigned coaches 3/10" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/head-calendar.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Update assignments" }).click();
  await expect(
    page.getByRole("checkbox", { name: "Marcus Tan", exact: true }),
  ).toBeChecked();
  await page
    .getByRole("checkbox", { name: /Aisyah Rahman/ })
    .first()
    .check();
  await page.getByRole("button", { name: "Submit assignments" }).click();
  await expect(
    page.getByRole("heading", { name: "Assigned coaches 4/10" }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Saturday, 19 September 2026", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Assigned coaches 4/10" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Saturday, 26 September 2026", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Assigned coaches 1/10" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next month" }).click();
  await expect(
    page.getByRole("heading", { name: "October 2026", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("hourly attendance saves and partial-hour cover keeps exact worked slots", async ({
  page,
}) => {
  await page.goto("/attendance/s19");
  // New blocks with 15-min breaks: 09:00-10:00, 10:15-11:15, 11:30-12:00
  // Ryan Coo is assigned to 10:15-12:00 which covers blocks 10:15-11:15 and 11:30-12:00
  await page
    .getByRole("button", { name: "Ryan Coo 10:15-11:15 Present", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save attendance", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: "Ryan Coo 10:15-11:15 Present",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Add coach", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Coach", exact: true })
    .selectOption("c4");
  await page.getByLabel("Start time", { exact: true }).fill("09:30");
  await page.getByLabel("End time", { exact: true }).fill("10:30");
  await page.getByRole("button", { name: "Add coach & worked slot" }).click();
  await expect(
    page.getByRole("button", {
      name: "Aisyah Rahman 09:30-10:00 Present",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", {
      name: "Aisyah Rahman 10:15-10:30 Present",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({
    path: "test-results/attendance.png",
    fullPage: true,
  });
});

test("assistant verifies, Admin resolves, final sheet verifies, CSV and Excel export", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/calendar");
  await page
    .getByRole("button", { name: "Saturday, 19 September 2026", exact: true })
    .click();
  await role(page, "Assistant Coach");
  await page.getByRole("link", { name: "My sessions", exact: true }).click();
  await page
    .getByRole("link", { name: "Verify worked hours", exact: true })
    .click();
  await page
    .getByRole("row")
    .filter({ hasText: "19 Sep 2026" })
    .getByRole("button", { name: "Review hours" })
    .click();
  await page
    .getByLabel("Explanation for different hours (required)")
    .fill("I stayed until noon to cover the final hour.");
  await page
    .getByRole("checkbox", {
      name: "I confirm these are the hours I actually worked.",
    })
    .check();
  await page
    .getByRole("button", { name: "Verify these hours", exact: true })
    .click();
  await page.getByRole("button", { name: "Send revised timesheet" }).click();
  await expect(
    page.getByText("Timesheet v2 sent", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/timesheet.png", fullPage: true });
  await role(page, "Admin");
  await page.getByRole("link", { name: "Reports", exact: true }).click();
  await page.getByRole("button", { name: "Review 1 differences" }).click();
  await page
    .getByRole("row")
    .filter({ hasText: "ATT-0008" })
    .getByRole("button", { name: "Ryan Coo", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Resolve difference", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Admin resolution", exact: true })
    .selectOption("coach");
  await page
    .getByLabel("Reason / evidence (required)")
    .fill("Both coaches confirmed Ryan covered the final hour.");
  await page.getByRole("button", { name: "Save resolution" }).click();
  await page
    .getByRole("button", { name: "Verify final sheet", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Verify final sheet", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Final sheet verified" }),
  ).toBeDisabled();
  await page.screenshot({
    path: "test-results/admin-final.png",
    fullPage: true,
  });
  const csvPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download .csv" }).click();
  const csv = await csvPromise;
  const content = await readFile((await csv.path())!, "utf8");
  expect(content.split("\r\n")).toHaveLength(10);
  expect(content).toContain("Both coaches confirmed Ryan");
  const excelPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Open in Excel" }).click();
  const excel = await excelPromise;
  expect(excel.suggestedFilename()).toMatch(/\.xlsx$/);
  expect(
    (await readFile((await excel.path())!)).subarray(0, 2).toString(),
  ).toBe("PK");
  expect(errors).toEqual([]);
});

test("Admin creates a programme and report filters have empty states", async ({
  page,
}) => {
  await page.goto("/calendar");
  await page
    .getByRole("button", { name: "Saturday, 19 September 2026", exact: true })
    .click();
  await role(page, "Admin");
  await page.getByRole("link", { name: "Programmes", exact: true }).click();
  await page
    .getByRole("button", { name: "Add programme", exact: true })
    .click();
  await page
    .getByLabel("Programme name *", { exact: true })
    .fill("Academy Coaching - Intermediate Programme");
  await page.getByLabel("Location *", { exact: true }).fill("Bishan Stadium");
  await page.getByRole("button", { name: "Create programme" }).click();
  await expect(
    page.getByRole("cell", {
      name: "Academy Coaching - Intermediate Programme",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Reports", exact: true }).click();
  await page
    .getByRole("button", { name: "View full sheet", exact: true })
    .first()
    .click();
  await page.getByRole("searchbox").fill("nonexistent");
  await expect(page.getByText("No records match these filters.")).toBeVisible();
  await expect(page.getByText(/Showing 0.*0 of 0/)).toBeVisible();
});

test("mobile layout and exact Figma assets load without page overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/calendar");
  await page
    .getByRole("button", { name: "Saturday, 19 September 2026", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Deploy your coaching team" }),
  ).toBeVisible();
  await expect(page.locator(".legend img")).toHaveCount(3);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const assets = await page.locator(".legend img").evaluateAll((images) =>
    images.map((image) => ({
      loaded: (image as HTMLImageElement).naturalWidth,
      width: image.getBoundingClientRect().width,
      height: image.getBoundingClientRect().height,
    })),
  );
  expect(assets).toEqual(
    Array.from({ length: 3 }, () => ({ loaded: 10, width: 10, height: 10 })),
  );
  await page.screenshot({
    path: "test-results/mobile-calendar.png",
    fullPage: true,
  });
});

test("approved changes remain in cancelled history and role survives refresh", async ({
  page,
}) => {
  await page.goto("/calendar");
  await page
    .getByRole("button", { name: "Saturday, 19 September 2026", exact: true })
    .click();
  await page.getByRole("button", { name: "Review change request" }).click();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await role(page, "Assistant Coach");
  await page.getByRole("link", { name: "My sessions", exact: true }).click();
  await page.getByRole("button", { name: "Cancelled", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Academy Coaching - Girls Only Seasonal Programme",
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "My sessions", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Open profile" })).toHaveText(
    "RC",
  );
});

test("attendance notes survive saving, reload and later hour edits", async ({
  page,
}) => {
  await page.goto("/attendance/s19");
  await page
    .getByLabel("Session notes (optional)")
    .fill("Ryan left after the first assigned hour.");
  await page
    .getByRole("button", { name: "Save attendance", exact: true })
    .click();
  await page.reload();
  await expect(page.getByLabel("Session notes (optional)")).toHaveValue(
    "Ryan left after the first assigned hour.",
  );
  await page
    .getByRole("button", { name: "Marcus Tan 09:00-10:00 Absent", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save attendance", exact: true })
    .click();
  await page.reload();
  await expect(page.getByLabel("Session notes (optional)")).toHaveValue(
    "Ryan left after the first assigned hour.",
  );
});

test("1000-row report paginates and exports every filtered row", async ({
  page,
}) => {
  const state = seed(),
    assignment = state.assignments[0];
  state.assignments = Array.from({ length: 1000 }, (_, i) => ({
    ...structuredClone(assignment),
    id: `LOAD-${String(i + 1).padStart(4, "0")}`,
  }));
  await page.addInitScript((data) => {
    localStorage.setItem("coach-calendar-v1", JSON.stringify(data));
  }, state);
  await page.goto("/calendar");
  await page
    .getByRole("button", { name: "Saturday, 19 September 2026", exact: true })
    .click();
  await role(page, "Admin");
  await page.getByRole("link", { name: "Reports", exact: true }).click();
  await page
    .getByRole("button", { name: "View full sheet", exact: true })
    .first()
    .click();
  await expect(page.getByRole("row")).toHaveCount(51);
  await expect(page.getByText("1 / 20", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByRole("row").nth(1).getByRole("cell").first(),
  ).toHaveText("51");
  await page.getByRole("searchbox").fill("LOAD-09");
  await expect(
    page.getByRole("button", { name: "Filtered results (100)", exact: true }),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download .csv", exact: true })
    .click();
  const file = await downloadPromise;
  const contents = await readFile((await file.path())!, "utf8");
  expect(contents.split("\r\n")).toHaveLength(101);
  expect(contents).toContain("LOAD-0999");
  await page.screenshot({
    path: "test-results/report-1000.png",
    fullPage: true,
  });
});
