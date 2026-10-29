import { expect, test } from "@playwright/test";

test("loads local assets, merges with real physics, pauses, resizes and restarts", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const external: string[] = [];
  const origin = new URL(test.info().project.use.baseURL as string).origin;
  page.on("request", (r) => {
    if (
      !r.url().startsWith(`${origin}/`) &&
      !r.url().startsWith("data:") &&
      !r.url().startsWith(`blob:${origin}/`)
    )
      external.push(r.url());
  });
  await page.clock.install();
  await page.goto("/");
  await expect(page.locator("#status")).toBeHidden();
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  // Keyboard follows the same input route as touch and is available on all hosts with keyboards.
  await page.keyboard.press("Space");
  await page.clock.runFor(2200);
  await page.keyboard.press("Space");
  await page.clock.runFor(2200);
  await expect(page.locator("#announcement")).toContainText("合成", {
    timeout: 5000,
  });
  const replay = await page.evaluate(() => window.__composeSitReplay?.());
  expect(replay?.rulesVersion).toBe(1);
  expect(replay?.planckVersion).toBe("1.5.1");
  expect(replay?.inputs.map((input) => input.order)).toEqual([1, 2]);
  expect(replay?.inputs.every((input) => input.tick > 0)).toBe(true);
  await page.keyboard.press("p");
  await page.clock.runFor(50);
  await page.keyboard.press("p");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas missing");
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.5);
  await page.mouse.up();
  await page.setViewportSize({ width: 430, height: 900 });
  await page.clock.runFor(100);
  await page.keyboard.press("m");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  if (
    await page
      .getByRole("button", { name: "重新开始", exact: true })
      .isVisible()
  )
    await page.getByRole("button", { name: "重新开始", exact: true }).click();
  else {
    const b = await canvas.boundingBox();
    if (!b) throw new Error("No canvas");
    const scale = Math.min(b.width / 720, b.height / 1280),
      ox = b.x + (b.width - 720 * scale) / 2,
      oy = b.y + (b.height - 1280 * scale) / 2;
    await page.mouse.click(ox + 516 * scale, oy + 85 * scale);
    await page.clock.runFor(50);
    await page.mouse.click(ox + 360 * scale, oy + 810 * scale);
  }
  await expect(page.locator("#announcement")).toContainText("新的一局");
  expect(
    (await page.evaluate(() => window.__composeSitReplay?.()))?.inputs,
  ).toEqual([]);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
test("remains playable when persistent storage is unavailable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error("storage disabled");
    };
    Storage.prototype.setItem = () => {
      throw new Error("storage disabled");
    };
  });
  await page.clock.install();
  await page.goto("/");
  await expect(page.locator("#status")).toBeHidden();
  await page.keyboard.press("Space");
  await page.clock.runFor(2200);
  await page.keyboard.press("Space");
  await page.clock.runFor(2200);
  await expect(page.locator("#announcement")).toContainText("合成", {
    timeout: 5000,
  });
});

test("shows a retry action when a required texture cannot load", async ({
  page,
}) => {
  await page.route("**/schools/0.png", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator("#status")).toContainText("游戏加载失败");
  await expect(page.getByRole("button", { name: "重新加载" })).toBeVisible();
});
