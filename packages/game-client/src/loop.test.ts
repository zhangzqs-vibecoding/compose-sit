import { describe, expect, it } from "vitest";
import { FixedLoop, logicalPoint } from "./loop";

describe("fixed loop", () => {
  for (const fps of [30, 60, 120])
    it(`runs 60 physics ticks per second at ${fps} FPS`, () => {
      const loop = new FixedLoop();
      let count = 0;
      for (let i = 0; i <= fps; i++)
        loop.advance((i * 1000) / fps, false, () => count++);
      expect(count).toBe(60);
    });
  it("limits catch-up and does not replay background time", () => {
    const loop = new FixedLoop();
    let count = 0;
    loop.advance(0, false, () => count++);
    loop.advance(1000, false, () => count++);
    expect(count).toBe(5);
    expect(loop.skippedTicks).toBeGreaterThan(0);
    loop.advance(5000, true, () => count++);
    loop.reset();
    loop.advance(8000, false, () => count++);
    expect(count).toBe(5);
  });
  it("converts CSS pointer coordinates independently of DPR and centering", () => {
    expect(
      logicalPoint(360, 640, { width: 720, height: 1280, pixelRatio: 3 }),
    ).toEqual({ x: 360, y: 640 });
    expect(
      logicalPoint(640, 360, { width: 1280, height: 720, pixelRatio: 2 }),
    ).toEqual({ x: 360, y: 640 });
  });
});
