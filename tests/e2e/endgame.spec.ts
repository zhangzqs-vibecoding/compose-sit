import { expect, test } from "@playwright/test";

test("real overflow opens the result screen, saves score and restarts via canvas controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 720, height: 1280 });
  await page.clock.install();
  await page.goto("http://127.0.0.1:4175/");
  await expect(page.locator("#status")).toBeHidden();
  await page.clock.runFor(500);
  await expect(page.locator("#announcement")).toContainText("本局结束，得分2");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("compose-sit:preferences") ?? "{}")
            .highScore,
      ),
    )
    .toBe(2);
  await page.mouse.click(360, 729);
  await expect(page.locator("#announcement")).toContainText("新的一局");
  await page.clock.runFor(500);
  await expect(page.locator("#announcement")).toContainText("本局结束，得分2");
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("compose-sit:preferences") ?? "{}")
          .highScore,
    ),
  ).toBe(2);
});
