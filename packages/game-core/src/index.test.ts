import { describe, expect, it } from "vitest";
import {
  clampDrop,
  DEFAULT_PREFERENCES,
  DEFAULT_RULES,
  generationLevel,
  mergePoints,
  overflowTime,
  Random,
  readPreferences,
  selectMerges,
  validateRules,
} from "./index";

describe("rules", () => {
  it("preserves the full opening and bounded seeded random sequence", () => {
    const random = new Random(77);
    const result = Array.from({ length: 100 }, (_, i) =>
      generationLevel(i, DEFAULT_RULES, random),
    );
    expect(result.slice(0, 7)).toEqual([0, 0, 0, 1, 2, 2, 3]);
    expect(result.slice(7).every((x) => x >= 0 && x < 5)).toBe(true);
    const other = new Random(77);
    expect(
      Array.from({ length: 100 }, (_, i) =>
        generationLevel(i, DEFAULT_RULES, other),
      ),
    ).toEqual(result);
  });
  it("resolves duplicate, reversed and triple contacts once in stable order", () => {
    const entities = new Map([1, 2, 3].map((id) => [id, { id, level: 0 }]));
    expect(
      selectMerges(entities, [
        [3, 2],
        [2, 1],
        [1, 2],
        [8, 9],
        [1, 1],
      ]),
    ).toEqual([[1, 2]]);
  });
  it("rejects unlike and final-level merges", () => {
    expect(
      selectMerges(
        new Map([
          [1, { id: 1, level: 10 }],
          [2, { id: 2, level: 10 }],
          [3, { id: 3, level: 0 }],
        ]),
        [
          [1, 2],
          [1, 3],
        ],
      ),
    ).toEqual([]);
  });
  it("awards terminal bonus and resets overflow outside the danger zone", () => {
    expect(mergePoints(0)).toBe(1);
    expect(mergePoints(9)).toBe(110);
    expect(overflowTime(179, true, true)).toBe(180);
    expect(overflowTime(179, true, false)).toBe(0);
    expect(overflowTime(179, false, true)).toBe(0);
  });
  it("validates external data and configuration", () => {
    expect(
      readPreferences({ schemaVersion: 1, highScore: Infinity, muted: true }),
    ).toEqual({ ...DEFAULT_PREFERENCES, muted: true });
    expect(readPreferences({ schemaVersion: 2, highScore: 100 })).toEqual(
      DEFAULT_PREFERENCES,
    );
    expect(() => validateRules({ ...DEFAULT_RULES, gravity: NaN })).toThrow();
    expect(() => validateRules({ ...DEFAULT_RULES, opening: [11] })).toThrow();
    expect(() =>
      validateRules({ ...DEFAULT_RULES, overflowTicks: 0 }),
    ).toThrow();
    expect(clampDrop(-100, 26, DEFAULT_RULES)).toBe(54);
  });
});
