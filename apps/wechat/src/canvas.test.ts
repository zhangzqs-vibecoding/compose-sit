import { expect, it } from "vitest";
import { adaptCanvas } from "./canvas";

it("adapts the actual Canvas subset Pixi uses without browser globals", () => {
  const context = {};
  const surface = { width: 1, height: 1, getContext: () => context };
  const adapted = adaptCanvas(surface);
  adapted.canvas.width = 430;
  expect(surface.width).toBe(430);
  expect(adapted.canvas.getContext("webgl")).toBe(context);
  let events = 0;
  const listener = () => events++;
  adapted.canvas.addEventListener("webglcontextlost", listener);
  adapted.contextChanged(true);
  expect(events).toBe(1);
  adapted.canvas.removeEventListener("webglcontextlost", listener);
  adapted.contextChanged(true);
  expect(events).toBe(1);
});
