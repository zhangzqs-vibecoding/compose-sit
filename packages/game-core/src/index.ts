export interface Level {
  readonly id: number;
  readonly name: string;
  readonly shortName: string;
  readonly radius: number;
  readonly color: number;
}
export const LEVELS: readonly Level[] = [
  { id: 0, name: "北京大学", shortName: "北大", radius: 26, color: 0xb32236 },
  { id: 1, name: "清华大学", shortName: "清华", radius: 39, color: 0x7a438c },
  {
    id: 2,
    name: "中国科学院",
    shortName: "中科院",
    radius: 54,
    color: 0x2259a0,
  },
  {
    id: 3,
    name: "中国人民大学",
    shortName: "人大",
    radius: 59.5,
    color: 0xa32835,
  },
  { id: 4, name: "复旦大学", shortName: "复旦", radius: 76, color: 0x147098 },
  {
    id: 5,
    name: "上海交通大学",
    shortName: "交大",
    radius: 91.5,
    color: 0x913246,
  },
  { id: 6, name: "浙江大学", shortName: "浙大", radius: 93, color: 0x276aa1 },
  {
    id: 7,
    name: "中国科学技术大学",
    shortName: "中科大",
    radius: 129,
    color: 0x246992,
  },
  { id: 8, name: "同济大学", shortName: "同济", radius: 154, color: 0x3069a5 },
  {
    id: 9,
    name: "上海理工大学",
    shortName: "上理",
    radius: 151,
    color: 0x158281,
  },
  {
    id: 10,
    name: "上海应用技术大学",
    shortName: "上应大",
    radius: 202,
    color: 0x22634e,
  },
];
export interface Rules {
  readonly width: number;
  readonly height: number;
  readonly wall: number;
  readonly floorY: number;
  readonly spawnY: number;
  readonly dangerY: number;
  readonly overflowTicks: number;
  readonly cooldownTicks: number;
  readonly previewTicks: number;
  readonly celebrationTicks: number;
  readonly gravity: number;
  readonly dropSpeed: number;
  readonly mergeSpeed: number;
  readonly pixelsPerMeter: number;
  readonly restitution: number;
  readonly friction: number;
  readonly velocityIterations: number;
  readonly positionIterations: number;
  readonly opening: readonly number[];
  readonly randomLevels: number;
}
export const DEFAULT_RULES: Rules = {
  width: 720,
  height: 1280,
  wall: 28,
  floorY: 1130,
  spawnY: 235,
  dangerY: 350,
  overflowTicks: 180,
  cooldownTicks: 60,
  previewTicks: 30,
  celebrationTicks: 180,
  gravity: -3,
  dropSpeed: -8,
  mergeSpeed: -1,
  pixelsPerMeter: 100,
  restitution: 0.1,
  friction: 1,
  velocityIterations: 8,
  positionIterations: 3,
  opening: [0, 0, 0, 1, 2, 2, 3],
  randomLevels: 5,
};
export function levelAt(id: number): Level {
  const level = LEVELS[id];
  if (!level) throw new RangeError(`Invalid level: ${id}`);
  return level;
}
export function validateRules(rules: Rules): Rules {
  for (const [key, value] of Object.entries(rules)) {
    if (
      key !== "opening" &&
      (typeof value !== "number" || !Number.isFinite(value))
    )
      throw new Error(`Invalid rule: ${key}`);
  }
  if (
    rules.width <= rules.wall * 2 + 404 ||
    rules.height <= rules.floorY ||
    rules.spawnY >= rules.dangerY ||
    rules.dangerY >= rules.floorY ||
    rules.wall < 0 ||
    rules.spawnY < 0 ||
    rules.pixelsPerMeter <= 0 ||
    rules.gravity >= 0 ||
    rules.dropSpeed >= 0 ||
    rules.mergeSpeed > 0 ||
    rules.restitution < 0 ||
    rules.restitution > 1 ||
    rules.friction < 0
  )
    throw new Error("Invalid board or physics rules");
  for (const value of [
    rules.overflowTicks,
    rules.cooldownTicks,
    rules.previewTicks,
    rules.celebrationTicks,
    rules.randomLevels,
    rules.velocityIterations,
    rules.positionIterations,
  ])
    if (!Number.isInteger(value) || value < 1)
      throw new Error("Tick counts must be positive integers");
  if (
    rules.previewTicks > rules.cooldownTicks ||
    rules.randomLevels > LEVELS.length ||
    rules.opening.length === 0
  )
    throw new Error("Invalid generation rules");
  for (const id of rules.opening) levelAt(id);
  return Object.freeze({
    ...rules,
    opening: Object.freeze([...rules.opening]),
  });
}
export class Random {
  private state: number;
  constructor(seed: number) {
    this.state = seed >>> 0 || 0x6d2b79f5;
  }
  next(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state / 4294967296;
  }
}
export function generationLevel(
  index: number,
  rules: Rules,
  random: Random,
): number {
  return rules.opening[index] ?? Math.floor(random.next() * rules.randomLevels);
}
export interface MergeEntity {
  readonly id: number;
  readonly level: number;
}
export function selectMerges(
  entities: ReadonlyMap<number, MergeEntity>,
  contacts: readonly (readonly [number, number])[],
): readonly (readonly [number, number])[] {
  const pairs = new Map<string, readonly [number, number]>();
  for (const [a, b] of contacts) {
    if (a === b) continue;
    const pair = [Math.min(a, b), Math.max(a, b)] as const;
    pairs.set(pair.join(":"), pair);
  }
  const used = new Set<number>();
  const result: (readonly [number, number])[] = [];
  for (const [a, b] of [...pairs.values()].sort(
    (x, y) => x[0] - y[0] || x[1] - y[1],
  )) {
    const first = entities.get(a),
      second = entities.get(b);
    if (
      !first ||
      !second ||
      first.level !== second.level ||
      first.level >= LEVELS.length - 1 ||
      used.has(a) ||
      used.has(b)
    )
      continue;
    result.push([a, b]);
    used.add(a);
    used.add(b);
  }
  return result;
}
export function mergePoints(level: number): number {
  levelAt(level);
  return level + 1 + (level === 9 ? 100 : 0);
}
export function clampDrop(x: number, radius: number, rules: Rules): number {
  return Math.max(
    rules.wall + radius,
    Math.min(rules.width - rules.wall - radius, x),
  );
}
export function overflowTime(
  previous: number,
  eligible: boolean,
  above: boolean,
): number {
  return eligible && above ? previous + 1 : 0;
}
export interface Preferences {
  readonly schemaVersion: 1;
  readonly highScore: number;
  readonly muted: boolean;
}
export const DEFAULT_PREFERENCES: Preferences = {
  schemaVersion: 1,
  highScore: 0,
  muted: false,
};
export function readPreferences(value: unknown): Preferences {
  if (
    !value ||
    typeof value !== "object" ||
    !("schemaVersion" in value) ||
    value.schemaVersion !== 1
  )
    return { ...DEFAULT_PREFERENCES };
  const highScore =
    "highScore" in value &&
    typeof value.highScore === "number" &&
    Number.isSafeInteger(value.highScore) &&
    value.highScore >= 0
      ? value.highScore
      : 0;
  return {
    schemaVersion: 1,
    highScore,
    muted: "muted" in value && value.muted === true,
  };
}
