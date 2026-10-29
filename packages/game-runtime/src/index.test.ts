import { DEFAULT_RULES } from "@compose-sit/game-core";
import { describe, expect, it } from "vitest";
import packageInfo from "../package.json";
import { GameSession, PLANCK_VERSION } from "./index";

function advance(game: GameSession, ticks: number): void {
  for (let i = 0; i < ticks; i++) game.step();
}
describe("real Planck simulation", () => {
  it("uses the legacy fruit's effective gravity", () => {
    const game = new GameSession({
      initialEntities: [{ level: 0, x: 360, y: 235 }],
    });
    advance(game, 60);
    expect(game.snapshot().entities[0]?.y).toBeCloseTo(692.5, 1);
    game.dispose();
  });
  it("drops into a stable floor and clamps release coordinates", () => {
    const game = new GameSession();
    game.drop(-100);
    advance(game, 600);
    const e = game.snapshot().entities[0];
    expect(e?.x).toBeGreaterThanOrEqual(52);
    expect(e?.y).toBeGreaterThan(DEFAULT_RULES.floorY - 28);
    expect(e?.y).toBeLessThan(DEFAULT_RULES.floorY - 25);
    expect(game.snapshot().entities).toHaveLength(1);
    game.dispose();
    expect(game.snapshot().canDrop).toBe(false);
  });
  it("merges the first three drops with the original score and sequence", () => {
    const game = new GameSession();
    for (let i = 0; i < 3; i++) {
      game.drop(360);
      advance(game, 90);
    }
    const snapshot = game.snapshot();
    expect(snapshot.score).toBe(1);
    expect(snapshot.preview).toBe(1);
    expect(snapshot.entities.map((e) => e.level).sort()).toEqual([0, 1]);
    expect(game.drainEvents().filter((e) => e.type === "merge")).toHaveLength(
      1,
    );
    advance(game, 120);
    expect(game.snapshot().score).toBe(1);
  });
  it("handles simultaneous triple contacts without stale bodies or duplicate score", () => {
    const game = new GameSession({
      initialEntities: [
        { level: 0, x: 300, y: 1100 },
        { level: 0, x: 350, y: 1100 },
        { level: 0, x: 400, y: 1100 },
      ],
    });
    game.step();
    expect(
      game
        .snapshot()
        .entities.map((e) => e.level)
        .sort(),
    ).toEqual([0, 1]);
    expect(game.snapshot().score).toBe(1);
  });
  it("awards a crown once, pauses input while physics continues and caps level", () => {
    const game = new GameSession({
      initialEntities: [
        { level: 9, x: 210, y: 970 },
        { level: 9, x: 510, y: 970 },
      ],
    });
    advance(game, 5);
    expect(game.snapshot().entities.map((e) => e.level)).toEqual([10]);
    expect(game.snapshot().score).toBe(110);
    expect(game.snapshot().canDrop).toBe(false);
    advance(game, 200);
    expect(game.snapshot().canDrop).toBe(true);
    expect(game.snapshot().score).toBe(110);
    expect(game.drainEvents().filter((e) => e.type === "crown")).toHaveLength(
      1,
    );
  });
  it("freezes tick and cancels pending input for independent pause reasons", () => {
    const game = new GameSession();
    game.drop(360);
    game.setPaused("manual", true);
    game.setPaused("hidden", true);
    advance(game, 60);
    expect(game.snapshot().tick).toBe(0);
    game.setPaused("hidden", false);
    game.step();
    expect(game.snapshot().status).toBe("paused");
    game.setPaused("manual", false);
    game.step();
    expect(game.snapshot().entities).toHaveLength(0);
    game.drop(360);
    game.step();
    expect(game.snapshot().entities).toHaveLength(1);
  });
  it("finishes once after continuous overflow and includes surviving entities exactly once", () => {
    const rules = { ...DEFAULT_RULES, dangerY: 1120, overflowTicks: 12 };
    const game = new GameSession({
      rules,
      initialEntities: [{ level: 1, x: 320, y: rules.floorY - 39 }],
    });
    advance(game, 30);
    const score = game.snapshot().score;
    expect(game.snapshot().status).toBe("gameOver");
    expect(score).toBe(2);
    advance(game, 600);
    expect(game.snapshot().score).toBe(score);
    expect(
      game.drainEvents().filter((e) => e.type === "gameOver"),
    ).toHaveLength(1);
  });
  it("has reproducible same-version physics and independent session events", () => {
    const a = new GameSession({ seed: 3 }),
      b = new GameSession({ seed: 3, sessionId: 7 });
    for (let i = 0; i < 10; i++) {
      a.drop(100 + i * 45);
      b.drop(100 + i * 45);
      advance(a, 65);
      advance(b, 65);
    }
    expect(a.snapshot().entities).toEqual(b.snapshot().entities);
    expect(a.snapshot().score).toBe(b.snapshot().score);
    expect(b.drainEvents().every((e) => e.sessionId === 7)).toBe(true);
  });
  it("exports effective inputs and reproduces the same physical state", () => {
    const game = new GameSession({ seed: 0x12345678, sessionId: 9 });
    game.drop(360);
    game.setPaused("hidden", true);
    advance(game, 5);
    game.setPaused("hidden", false);
    for (let i = 0; i < 9; i++) {
      game.drop(100 + i * 45);
      game.drop(600);
      advance(game, 65);
    }
    const record = game.exportReplay();
    expect(JSON.parse(JSON.stringify(record))).toEqual(record);
    expect(record.schemaVersion).toBe(1);
    expect(record.rulesVersion).toBe(2);
    expect(record.planckVersion).toBe(packageInfo.dependencies.planck);
    expect(PLANCK_VERSION).toBe(packageInfo.dependencies.planck);
    expect(record.seed).toBe(0x12345678);
    expect(record.sessionId).toBe(9);
    expect(record.rules).toEqual(DEFAULT_RULES);
    expect(record.inputs).toHaveLength(9);
    expect(record.inputs.map((input) => input.order)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
    expect(record.inputs[0]).toEqual({
      tick: 1,
      order: 1,
      type: "drop",
      x: 100,
    });
    const replayed = new GameSession({
      seed: record.seed,
      sessionId: record.sessionId,
      rules: record.rules,
      initialEntities: record.initialEntities,
    });
    let nextInput = 0;
    for (let tick = 1; tick <= record.endTick; tick++) {
      const input = record.inputs[nextInput];
      if (input?.tick === tick) {
        replayed.drop(input.x);
        nextInput++;
      }
      replayed.step();
    }
    expect(nextInput).toBe(record.inputs.length);
    expect(replayed.snapshot()).toEqual(game.snapshot());
  });
  it("survives a dense 200-body scene without NaN or escaped bodies", () => {
    const game = new GameSession({
      rules: { ...DEFAULT_RULES, overflowTicks: 36000 },
      initialEntities: Array.from({ length: 200 }, (_, i) => ({
        level: 0,
        x: 60 + (i % 10) * 64,
        y: 1100 - Math.floor(i / 10) * 56,
      })),
    });
    advance(game, 600);
    for (const e of game.snapshot().entities) {
      expect(Number.isFinite(e.x + e.y + e.angle)).toBe(true);
      expect(e.y).toBeLessThan(DEFAULT_RULES.floorY + 2);
    }
    game.dispose();
    expect(game.snapshot().entities).toHaveLength(0);
  });
});
