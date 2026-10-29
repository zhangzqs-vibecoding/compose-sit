export class FixedLoop {
  private last: number | undefined;
  private accumulator = 0;
  skippedTicks = 0;
  advance(timestamp: number, paused: boolean, step: () => void): number {
    if (paused || this.last === undefined) {
      this.last = timestamp;
      this.accumulator = 0;
      return 0;
    }
    const elapsed = Math.max(0, Math.min(250, timestamp - this.last));
    this.last = timestamp;
    this.accumulator += elapsed;
    const dt = 1000 / 60;
    let steps = 0;
    while (this.accumulator + 1e-8 >= dt && steps < 5) {
      step();
      this.accumulator -= dt;
      steps++;
    }
    if (this.accumulator >= dt) {
      const skipped = Math.floor(this.accumulator / dt);
      this.skippedTicks += skipped;
      this.accumulator -= skipped * dt;
    }
    return Math.max(0, this.accumulator / dt);
  }
  reset(): void {
    this.last = undefined;
    this.accumulator = 0;
  }
}
export interface Viewport {
  readonly width: number;
  readonly height: number;
  readonly pixelRatio: number;
}
export function layout(viewport: Viewport): {
  scale: number;
  x: number;
  y: number;
} {
  const scale = Math.min(viewport.width / 720, viewport.height / 1280);
  return {
    scale,
    x: (viewport.width - 720 * scale) / 2,
    y: (viewport.height - 1280 * scale) / 2,
  };
}
export function logicalPoint(
  x: number,
  y: number,
  viewport: Viewport,
): { x: number; y: number } {
  const t = layout(viewport);
  return { x: (x - t.x) / t.scale, y: (y - t.y) / t.scale };
}
