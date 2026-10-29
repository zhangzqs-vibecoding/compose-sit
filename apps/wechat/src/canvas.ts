import type { ICanvas } from "pixi.js";

interface Surface {
  width: number;
  height: number;
  getContext(type: string, options?: unknown): unknown;
}
type ContextEvent = { type: string; preventDefault(): void };
export function adaptCanvas(surface: Surface): {
  canvas: ICanvas;
  contextChanged(lost: boolean): void;
} {
  const listeners = new Map<string, Set<(event: ContextEvent) => void>>();
  const canvas = {
    get width() {
      return surface.width;
    },
    set width(value: number) {
      surface.width = value;
    },
    get height() {
      return surface.height;
    },
    set height(value: number) {
      surface.height = value;
    },
    style: {},
    getContext: (type: string, options?: unknown) =>
      surface.getContext(type, options),
    addEventListener(type: string, callback: (event: ContextEvent) => void) {
      let group = listeners.get(type);
      if (!group) {
        group = new Set();
        listeners.set(type, group);
      }
      group.add(callback);
    },
    removeEventListener(type: string, callback: (event: ContextEvent) => void) {
      listeners.get(type)?.delete(callback);
    },
  } as unknown as ICanvas;
  return {
    canvas,
    contextChanged(lost) {
      const type = lost ? "webglcontextlost" : "webglcontextrestored";
      for (const callback of listeners.get(type) ?? [])
        callback({ type, preventDefault() {} });
    },
  };
}
