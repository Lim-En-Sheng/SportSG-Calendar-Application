import { test, expect } from "@playwright/test";
import { seed } from "../fixture";
for (const decision of ["Approve", "Reject"])
  for (const other of [false, true])
    test(`change request review and approval with other programme: ${other}, decision: ${decision}`, async ({
      page,
    }) => {
      const state = seed();
      state.requests = [];
      if (other) {
        state.sessions.push({
          ...state.sessions[3],
          id: "other",
          title: "Other programme",
        });
        state.assignments.push({
          ...state.assignments[state.assignments.length - 1],
          id: "other-assignment",
          sessionId: "other",
        });
      }
      await page.clock.setFixedTime(new Date("2026-09-20T06:00:00Z"));
      await page.addInitScript((s) => {
        if (!localStorage.getItem("coach-calendar-v1"))
          localStorage.setItem("coach-calendar-v1", JSON.stringify(s));
      }, state);
      async function login(id: string) {
        await page.goto("/");
        await page
          .getByRole("combobox", { name: "Full name / Coach ID" })
          .selectOption(id);
        await page.getByRole("button", { name: "Log in", exact: true }).click();
      }
      await login("c2");
      await page.goto("/sessions?session=s26");
      await page
        .getByRole("button", { name: "Request change", exact: true })
        .click();
      await expect(
        page.getByRole("checkbox", { name: "11:00–12:00", exact: true }),
      ).toBeChecked();
      await expect(
        page.getByRole("checkbox", { name: "12:15–12:30", exact: true }),
      ).toBeChecked();
      await page
        .getByRole("checkbox", { name: "12:15–12:30", exact: true })
        .uncheck();
      await page.getByLabel("Reason", { exact: true }).fill("Need to leave early");
      await page.getByRole("button", { name: "Submit request" }).click();
      await page.goto("/calendar");
      const day = page.getByRole("button", {
        name: "Saturday, 26 September 2026",
        exact: true,
      });
      await expect(day).toHaveClass(/change-pending-date/);
      await expect(page.locator(".daily-panel")).not.toContainText(
        "Need to leave early",
      );
      await page
        .locator(".daily-panel")
        .getByRole("button", { name: /Girls Only/ })
        .click();
      await expect(page.getByRole("dialog")).toContainText(
        "Need to leave early",
      );
      await page.getByRole("button", { name: "Close dialog" }).click();
      await login("head");
      await page.getByRole("button", { name: "Review change request" }).click();
      await expect(
        page.getByRole("heading", { name: "Original time slots" }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Requested time slots" }),
      ).toBeVisible();
      await expect(page.getByRole("dialog")).toContainText("11:00–12:00");
      await page.getByRole("button", { name: decision, exact: true }).click();
      await login("c2");
      await expect(day).toHaveCSS("background-color", "rgb(220, 252, 231)");
      await expect(
        page
          .locator(".daily-panel")
          .getByRole("button", { name: /Girls Only/ }),
      ).toHaveCount(0);
      await expect(
        page.locator(".daily-panel").getByRole("link", { name: /Girls Only/ }),
      ).toBeVisible();
      await page.reload();
      await expect(day).toHaveCSS("background-color", "rgb(220, 252, 231)");
    });
