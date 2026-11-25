import { seed } from "../fixture";
import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.addInitScript((fixture) => {
    if (!localStorage.getItem("coach-calendar-v1"))
      localStorage.setItem("coach-calendar-v1", JSON.stringify(fixture));
  }, seed());
  await page.clock.setFixedTime(new Date("2026-09-20T06:00:00Z"));
});

test("Figma login, profile and sign-out protect local navigation", async ({
  page,
}) => {
  await page.goto("/reports");
  await expect(
    page.getByRole("heading", { name: "Welcome Log in" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.screenshot({
    path: "test-results/login-desktop.png",
    fullPage: true,
  });
  const card = await page.locator(".login-card").boundingBox();
  expect(card?.width).toBe(560);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/login-mobile.png",
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page
    .getByRole("combobox", { name: "Full name / Coach ID" })
    .selectOption("head");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Deploy your coaching team" }),
  ).toBeVisible();
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Welcome Log in" }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Full name / Coach ID" })
    .selectOption("head");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.getByRole("button", { name: "Open profile" }).click();
  const profile = page.getByRole("dialog");
  await expect(
    profile.getByRole("heading", { name: "Maya Chen" }),
  ).toBeVisible();
  await expect(profile.getByRole("combobox")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Switch role/i })).toHaveCount(
    0,
  );
  await profile.getByRole("button", { name: "Sign out" }).click();
  await page.goto("/attendance/s19");
  await expect(
    page.getByRole("heading", { name: "Welcome Log in" }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Full name / Coach ID" })
    .selectOption("c2");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Set your monthly availability" }),
  ).toBeVisible();
  await page.goto("/reports");
  await expect(
    page.getByRole("heading", { name: "Set your monthly availability" }),
  ).toBeVisible();
});

test("confirmed coaches can be unassigned, retained in history and reassigned", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("combobox", { name: "Full name / Coach ID" })
    .selectOption("head");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page
    .getByRole("button", { name: "Saturday, 26 September 2026", exact: true })
    .click();
  await page.getByRole("button", { name: "Update assignments" }).click();
  await page.getByRole("checkbox", { name: "Ryan Coo", exact: true }).uncheck();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Assigned coaches 1/10" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Update assignments" }).click();
  await page.getByRole("checkbox", { name: "Ryan Coo", exact: true }).uncheck();
  await page.getByRole("button", { name: "Submit assignments" }).click();
  await expect(
    page.getByRole("heading", { name: "Assigned coaches 0/10" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Change requests · 0 pending" }),
  ).toBeVisible();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("coach-calendar-v1")!),
  );
  expect(
    saved.assignments.find((a: { sessionId: string }) => a.sessionId === "s26")
      .cancelled,
  ).toBe(true);
  expect(saved.audit[0].action).toBe("Assignments updated");
  await page.reload();
  await page
    .getByRole("button", { name: "Saturday, 26 September 2026", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Assigned coaches 0/10" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "My sessions", exact: true }).click();
  await page.getByRole("button", { name: "Cancelled", exact: true }).click();
  await page.getByRole("button", { name: "View details" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Assigned coaches: None",
  );
  await expect(page.getByRole("dialog")).toContainText(
    "Cancelled assignments: Ryan Coo",
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("link", { name: "Calendar", exact: true }).click();
  await page
    .getByRole("button", { name: "Saturday, 26 September 2026", exact: true })
    .click();
  await page.getByRole("button", { name: "Update assignments" }).click();
  await page.getByRole("checkbox", { name: /Ryan Coo/ }).check();
  await page.getByRole("button", { name: "Submit assignments" }).click();
  await expect(
    page.getByRole("heading", { name: "Assigned coaches 1/10" }),
  ).toBeVisible();
});

test("demo account dropdown signs in each coach with the correct identity", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByLabel("Password", { exact: true })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Log in", exact: true }),
  ).toBeDisabled();
  const accounts = page.getByRole("combobox", { name: "Full name / Coach ID" });
  await expect(accounts.locator("option")).toHaveCount(9);
  const coaches = [
    "Marcus Tan",
    "Ryan Coo",
    "Priya Nair",
    "Aisyah Rahman",
    "Sarah Koh",
    "Danish Hakim",
  ];
  for (let index = 0; index < coaches.length; index++) {
    await accounts.selectOption(`c${index + 1}`);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await page.getByRole("button", { name: "Open profile" }).click();
    await expect(
      page
        .getByRole("dialog")
        .getByRole("heading", { name: coaches[index], exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
  }
});
