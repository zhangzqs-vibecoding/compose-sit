import {
  clampDrop,
  DEFAULT_RULES,
  generationLevel,
  levelAt,
  mergePoints,
  overflowTime,
  Random,
  type Rules,
  selectMerges,
  validateRules,
} from "@compose-sit/game-core";
import { type Body, Box, Circle, Vec2, World } from "planck";
export type Status = "ready" | "playing" | "paused" | "gameOver";
export interface EntitySnapshot {
  readonly id: number;
  readonly level: number;
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly overflow: number;
}
export interface Snapshot {
  readonly sessionId: number;
  readonly tick: number;
  readonly status: Status;
  readonly score: number;
  readonly preview: number;
  readonly previewVisible: boolean;
  readonly canDrop: boolean;
  readonly celebration: number;
  readonly entities: readonly EntitySnapshot[];
}
export interface GameEvent {
  readonly sessionId: number;
  readonly id: number;
  readonly type: "drop" | "merge" | "crown" | "gameOver";
  readonly x: number;
  readonly y: number;
  readonly level: number;
  readonly points: number;
}
interface Entity {
  id: number;
  level: number;
  body: Body;
  entered: boolean;
  overflow: number;
}
export interface InitialEntity {
  readonly level: number;
  readonly x: number;
  readonly y: number;
  readonly entered?: boolean;
}
export interface SessionOptions {
  readonly seed?: number;
  readonly sessionId?: number;
  readonly rules?: Rules;
  readonly initialEntities?: readonly InitialEntity[];
}
export class GameSession {
  readonly rules: Rules;
  readonly sessionId: number;
  private world: World;
  private entities = new Map<number, Entity>();
  private random: Random;
  private nextId = 1;
  private eventId = 0;
  private events: GameEvent[] = [];
  private tick = 0;
  private score = 0;
  private generation = 0;
  private preview = 0;
  private readyAt = 0;
  private lockedUntil = 0;
  private status: "ready" | "playing" | "gameOver" = "ready";
  private pauses = new Set<string>();
  private drops: number[] = [];
  private disposed = false;
  constructor(options: SessionOptions = {}) {
    this.rules = validateRules(options.rules ?? DEFAULT_RULES);
    this.sessionId = options.sessionId ?? 1;
    this.random = new Random(options.seed ?? 1);
    this.preview = generationLevel(0, this.rules, this.random);
    this.world = new World({
      gravity: Vec2(0, this.rules.gravity),
      allowSleep: true,
    });
    const p = this.rules.pixelsPerMeter,
      r = this.rules;
    const floor = (r.height - r.floorY) / p;
    const ground = this.world.createBody();
    ground.createFixture(
      Box(r.width / p, 0.2, Vec2(r.width / p / 2, floor - 0.2)),
      { friction: r.friction },
    );
    ground.setUserData("floor");
    for (const x of [r.wall / p - 0.2, (r.width - r.wall) / p + 0.2])
      this.world
        .createBody()
        .createFixture(Box(0.2, r.height / p, Vec2(x, r.height / p / 2)), {
          friction: r.friction,
        });
    for (const entity of options.initialEntities ?? [])
      this.spawn(entity.level, entity.x, entity.y, 0, entity.entered ?? true);
  }
  setPaused(reason: string, paused: boolean): void {
    if (this.disposed) return;
    if (paused) this.pauses.add(reason);
    else this.pauses.delete(reason);
    this.drops = [];
  }
  drop(x: number): void {
    if (
      Number.isFinite(x) &&
      this.snapshot().canDrop &&
      this.drops.length === 0
    )
      this.drops.push(x);
  }
  step(): void {
    if (this.disposed || this.pauses.size || this.status === "gameOver") return;
    this.tick++;
    const x = this.drops.shift();
    if (
      x !== undefined &&
      this.tick >= this.readyAt &&
      this.tick >= this.lockedUntil
    ) {
      const level = this.preview;
      const at = clampDrop(x, levelAt(level).radius, this.rules);
      this.spawn(level, at, this.rules.spawnY, this.rules.dropSpeed, false);
      this.status = "playing";
      this.readyAt = this.tick + this.rules.cooldownTicks;
      this.preview = generationLevel(
        ++this.generation,
        this.rules,
        this.random,
      );
      this.emit("drop", at, this.rules.spawnY, level, 0);
    }
    this.world.step(
      1 / 60,
      this.rules.velocityIterations,
      this.rules.positionIterations,
    );
    const contacts: [number, number][] = [];
    for (
      let contact = this.world.getContactList();
      contact;
      contact = contact.getNext()
    ) {
      if (!contact.isTouching()) continue;
      const a = contact.getFixtureA().getBody().getUserData();
      const b = contact.getFixtureB().getBody().getUserData();
      if (typeof a === "number" && (typeof b === "number" || b === "floor")) {
        const e = this.entities.get(a);
        if (e) e.entered = true;
      }
      if (typeof b === "number" && (typeof a === "number" || a === "floor")) {
        const e = this.entities.get(b);
        if (e) e.entered = true;
      }
      if (typeof a === "number" && typeof b === "number") contacts.push([a, b]);
    }
    for (const [a, b] of selectMerges(this.entities, contacts)) {
      const first = this.entities.get(a),
        second = this.entities.get(b);
      if (!first || !second) continue;
      const pa = first.body.getPosition(),
        pb = second.body.getPosition();
      const lower = pa.y < pb.y ? pa : pb;
      const at = {
        x: lower.x * this.rules.pixelsPerMeter,
        y: this.rules.height - lower.y * this.rules.pixelsPerMeter,
      };
      const level = first.level;
      this.remove(a);
      this.remove(b);
      this.spawn(
        level + 1,
        clampDrop(at.x, levelAt(level + 1).radius, this.rules),
        at.y,
        this.rules.mergeSpeed,
        true,
      );
      const points = mergePoints(level);
      this.score += points;
      this.emit(level === 9 ? "crown" : "merge", at.x, at.y, level + 1, points);
      if (level === 9)
        this.lockedUntil = Math.max(
          this.lockedUntil,
          this.tick + this.rules.celebrationTicks,
        );
    }
    for (const entity of this.entities.values()) {
      const top =
        this.rules.height -
        entity.body.getPosition().y * this.rules.pixelsPerMeter -
        levelAt(entity.level).radius;
      entity.overflow = overflowTime(
        entity.overflow,
        entity.entered,
        top < this.rules.dangerY,
      );
      if (entity.overflow >= this.rules.overflowTicks) {
        this.finish();
        break;
      }
    }
  }
  snapshot(): Snapshot {
    const paused = this.pauses.size > 0;
    return {
      sessionId: this.sessionId,
      tick: this.tick,
      status: paused && this.status !== "gameOver" ? "paused" : this.status,
      score: this.score,
      preview: this.preview,
      previewVisible: this.tick >= this.readyAt - this.rules.previewTicks,
      canDrop:
        !this.disposed &&
        !paused &&
        this.status !== "gameOver" &&
        this.tick >= this.readyAt &&
        this.tick >= this.lockedUntil,
      celebration: Math.max(0, this.lockedUntil - this.tick),
      entities: [...this.entities.values()].map((e) => ({
        id: e.id,
        level: e.level,
        x: e.body.getPosition().x * this.rules.pixelsPerMeter,
        y:
          this.rules.height -
          e.body.getPosition().y * this.rules.pixelsPerMeter,
        angle: -e.body.getAngle(),
        overflow: e.overflow,
      })),
    };
  }
  drainEvents(): GameEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }
  dispose(): void {
    this.disposed = true;
    for (const id of [...this.entities.keys()]) this.remove(id);
    this.drops = [];
    this.events = [];
  }
  private spawn(
    level: number,
    x: number,
    y: number,
    speed: number,
    entered: boolean,
  ): void {
    const r = this.rules,
      p = r.pixelsPerMeter;
    const id = this.nextId++;
    const body = this.world.createDynamicBody({
      position: Vec2(x / p, (r.height - y) / p),
      linearVelocity: Vec2(0, speed),
      bullet: true,
      userData: id,
    });
    body.createFixture(Circle(levelAt(level).radius / p), {
      density: 1,
      friction: r.friction,
      restitution: r.restitution,
    });
    this.entities.set(id, { id, level, body, entered, overflow: 0 });
  }
  private remove(id: number): void {
    const entity = this.entities.get(id);
    if (entity) {
      this.world.destroyBody(entity.body);
      this.entities.delete(id);
    }
  }
  private finish(): void {
    if (this.status === "gameOver") return;
    this.status = "gameOver";
    this.drops = [];
    const bonus = [...this.entities.values()].reduce(
      (sum, e) => sum + e.level + 1,
      0,
    );
    this.score += bonus;
    this.emit("gameOver", 0, 0, 0, bonus);
  }
  private emit(
    type: GameEvent["type"],
    x: number,
    y: number,
    level: number,
    points: number,
  ): void {
    this.events.push({
      sessionId: this.sessionId,
      id: ++this.eventId,
      type,
      x,
      y,
      level,
      points,
    });
  }
}
