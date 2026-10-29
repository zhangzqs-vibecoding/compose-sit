import { performance } from "node:perf_hooks";
import { DEFAULT_RULES } from "../packages/game-core/src/index";
import { GameSession } from "../packages/game-runtime/src/index";

for (const count of [100, 200]) {
  const game = new GameSession({
    rules: { ...DEFAULT_RULES, overflowTicks: 36000 },
    initialEntities: Array.from({ length: count }, (_, i) => ({
      level: i % 5,
      x: 60 + (i % 10) * 64,
      y: 350 + Math.floor(i / 10) * 30,
    })),
  });
  const times: number[] = [];
  for (let i = 0; i < 3600; i++) {
    const start = performance.now();
    game.step();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  console.log(
    JSON.stringify({
      initialBodies: count,
      ticks: 3600,
      p50: times[1800],
      p95: times[3420],
      p99: times[3564],
      finalBodies: game.snapshot().entities.length,
      heapMiB: process.memoryUsage().heapUsed / 1024 / 1024,
    }),
  );
  game.dispose();
}
