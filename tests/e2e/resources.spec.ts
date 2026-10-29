import { expect, test } from "@playwright/test";

test("repeated restarts keep browser resources stable and input working", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.clock.install();
  await page.goto("/");
  await expect(page.locator("#status")).toBeHidden();
  await page.clock.runFor(100);

  const cdp = await page.context().newCDPSession(page);
  async function sample() {
    await cdp.send("HeapProfiler.collectGarbage");
    const dom = await cdp.send("Memory.getDOMCounters");
    const heap = await cdp.send("Runtime.getHeapUsage");
    return {
      documents: dom.documents as number,
      nodes: dom.nodes as number,
      listeners: dom.jsEventListeners as number,
      heapUsedBytes: heap.usedSize as number,
    };
  }

  const restart = page.getByRole("button", { name: "重新开始", exact: true });
  await restart.click();
  await page.clock.runFor(100);
  const before = await sample();
  for (let i = 0; i < 20; i++) {
    await restart.evaluate((button) => (button as HTMLButtonElement).click());
    await page.clock.runFor(20);
  }
  const afterTwenty = await sample();
  for (let i = 0; i < 20; i++) {
    await restart.evaluate((button) => (button as HTMLButtonElement).click());
    await page.clock.runFor(20);
  }
  const after = await sample();
  console.log(JSON.stringify({ before, afterTwenty, afterForty: after }));
  await testInfo.attach("restart-resource-sample", {
    body: JSON.stringify({ before, afterTwenty, afterForty: after }, null, 2),
    contentType: "application/json",
  });
  expect(after.documents).toBe(afterTwenty.documents);
  expect(after.nodes).toBeLessThanOrEqual(afterTwenty.nodes);
  expect(after.listeners).toBeLessThanOrEqual(afterTwenty.listeners);

  await page.locator("canvas").focus();
  await page.keyboard.press("Space");
  await page.clock.runFor(100);
  expect(
    (await page.evaluate(() => window.__composeSitReplay?.()))?.inputs,
  ).toHaveLength(1);
  expect(errors).toEqual([]);
});
