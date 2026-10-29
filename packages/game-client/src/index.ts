import {
  clampDrop,
  DEFAULT_PREFERENCES,
  LEVELS,
  levelAt,
  type Preferences,
  readPreferences,
} from "@compose-sit/game-core";
import {
  type GameEvent,
  GameSession,
  type SessionOptions,
  type Snapshot,
} from "@compose-sit/game-runtime";
import {
  Container,
  Graphics,
  Sprite,
  type Texture,
  WebGLRenderer,
} from "pixi.js";
import assetManifest from "../../../assets/manifest.json";
import type { Action, Host, Input } from "./host";
import { FixedLoop, layout, logicalPoint } from "./loop";
import { BitmapLabel } from "./text";

export type { Action, Host, Input, Sound } from "./host";
export { FixedLoop, layout, logicalPoint } from "./loop";
export interface Game {
  snapshot(): Snapshot;
  action(action: Action): void;
  suspend(reason: string, suspended: boolean): void;
  dispose(): void;
}
interface Effect {
  view: Container;
  life: number;
  duration: number;
}
const INK = 0x183d53,
  TEAL = 0x237d71,
  PAPER = 0xf6fafb;
export async function createGame(
  host: Host,
  options: SessionOptions = {},
): Promise<Game> {
  const renderer = new WebGLRenderer();
  const textures: Texture[] = [];
  try {
    await renderer.init({
      canvas: host.canvas,
      width: host.viewport().width,
      height: host.viewport().height,
      resolution: Math.min(host.viewport().pixelRatio, 2),
      antialias: true,
      background: 0xe8f0f4,
      autoDensity: false,
      skipExtensionImports: true,
    });
    const loaded = await Promise.allSettled(
      [assetManifest.font, ...assetManifest.schools].map((path) =>
        host.loadTexture(path),
      ),
    );
    for (const result of loaded)
      if (result.status === "fulfilled") textures.push(result.value);
    const failed = loaded.find((result) => result.status === "rejected");
    if (failed?.status === "rejected")
      throw new Error("Unable to load game artwork", { cause: failed.reason });
  } catch (error) {
    for (const texture of textures) texture.destroy(true);
    try {
      renderer.destroy();
    } catch {
      /* Renderer may not have completed initialization. */
    }
    host.dispose();
    throw error;
  }
  const atlas = textures[0];
  if (!atlas) throw new Error("Missing font atlas");
  let preferences: Preferences = { ...DEFAULT_PREFERENCES };
  try {
    preferences = readPreferences(await host.loadPreferences());
  } catch {
    /* Storage is optional. */
  }
  host.setMuted(preferences.muted);
  let saving = Promise.resolve();
  function save(): void {
    const value = { ...preferences };
    saving = saving
      .catch(() => {})
      .then(() => host.savePreferences(value))
      .catch(() => {});
  }
  const stage = new Container(),
    board = new Container(),
    entitiesView = new Container(),
    previewView = new Container(),
    effectsView = new Container(),
    overlay = new Container();
  stage.addChild(board);
  let sessionId = options.sessionId ?? 1;
  let session = new GameSession({ ...options, sessionId });
  const r = session.rules;
  const loop = new FixedLoop();
  let frameId = 0,
    disposed = false,
    manualPause = false,
    visible = true,
    contextLost = false;
  let aim = r.width / 2;
  let pointer: number | undefined;
  let pointerButton: Action | undefined;
  let previous = session.snapshot();
  const entityViews = new Map<number, Container>(),
    effects: Effect[] = [];
  const chrome = new Graphics()
    .roundRect(8, 8, 704, 1264, 32)
    .fill(PAPER)
    .stroke({ color: 0xcedde4, width: 2 });
  board.addChild(chrome);
  function label(
    text: string,
    x: number,
    y: number,
    size: number,
    color = INK,
    align: "left" | "center" | "right" = "left",
    parent: Container = board,
  ): BitmapLabel {
    const view = new BitmapLabel(atlas as Texture, size, color, align).set(
      text,
    );
    view.position.set(x, y);
    parent.addChild(view);
    return view;
  }
  label("CAMPUS COLLECTION", 42, 37, 18, TEAL);
  label("合成上应大", 40, 66, 41);
  label("拖动选择位置，松手投放", 42, 124, 22, 0x6b8190);
  const scoreLabel = label("0", 44, 166, 42),
    bestLabel = label("0", 390, 166, 28, INK, "right");
  label("当前得分", 44, 151, 20, 0x6b8190);
  label("最高纪录", 390, 151, 20, 0x6b8190, "right");
  function button(
    text: string,
    x: number,
    y: number,
    width: number,
    parent = board,
  ): BitmapLabel {
    parent.addChild(
      new Graphics().roundRect(x, y, width, 58, 16).fill(0xe3edf1),
    );
    return label(text, x + width / 2, y + 18, 22, INK, "center", parent);
  }
  button("暂停", 470, 56, 92);
  button("声音", 574, 56, 100);
  const muteLabel = label("ON", 624, 125, 14, TEAL, "center");
  board.addChild(
    new Graphics().roundRect(24, 296, 672, 850, 24).fill(0xe7f1f1),
  );
  const grid = new Graphics();
  for (let y = 380; y < r.floorY; y += 48)
    for (let x = 60; x < 680; x += 48) grid.circle(x, y, 1.4).fill(0xc7dcd8);
  board.addChild(grid);
  const danger = new Graphics();
  for (let x = 42; x < 680; x += 24)
    danger
      .moveTo(x, r.dangerY)
      .lineTo(x + 10, r.dangerY)
      .stroke({ color: 0xc88369, width: 2 });
  board.addChild(danger);
  label("危险区域", 360, r.dangerY - 26, 14, 0xb37e69, "center");
  board.addChild(entitiesView);
  const guide = new Graphics();
  board.addChild(guide, previewView, effectsView);
  board.addChild(new Graphics().roundRect(24, r.floorY, 672, 18, 7).fill(TEAL));
  label("校园图鉴", 42, 1171, 18);
  const progressLabel = label("1 / 11", 674, 1171, 18, TEAL, "right");
  const badges: Container[] = [];
  function badge(level: number, radius: number): Container {
    const root = new Container();
    root.addChild(
      new Graphics()
        .circle(0, 3, radius + 2)
        .fill({ color: 0x20495b, alpha: 0.1 })
        .circle(0, 0, radius + 1)
        .fill(0xffffff)
        .stroke({ color: levelAt(level).color, width: 2 }),
    );
    const texture = textures[level + 1];
    if (texture) {
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.width = radius * 1.84;
      sprite.height = radius * 1.84;
      root.addChild(sprite);
    }
    return root;
  }
  for (const level of LEVELS) {
    const icon = badge(level.id, 21);
    icon.position.set(65 + level.id * 59, 1223);
    board.addChild(icon);
    badges.push(icon);
  }
  board.addChild(overlay);
  const overlayBg = new Graphics()
    .roundRect(24, 296, 672, 850, 24)
    .fill({ color: 0x15374b, alpha: 0.9 });
  overlay.addChild(overlayBg);
  const overlayTitle = label("暂停", 360, 530, 46, 0xffffff, "center", overlay);
  const overlayDetail = label("", 360, 610, 22, 0xbcd9dc, "center", overlay);
  const resumeButton = button("继续游戏", 215, 700, 290, overlay);
  button("重新开始", 215, 780, 290, overlay);
  overlay.visible = false;
  const topMessage = label("", 360, 270, 18, TEAL, "center");
  let currentPreview = -1;
  const collected = new Set<number>([0]);
  function resize(): void {
    const viewport = host.viewport();
    renderer.resolution = Math.min(viewport.pixelRatio, 2);
    renderer.resize(viewport.width, viewport.height);
    const t = layout(viewport);
    board.position.set(t.x, t.y);
    board.scale.set(t.scale);
    pointer = undefined;
  }
  function pause(): void {
    session.setPaused("manual", manualPause);
    session.setPaused("hidden", !visible);
    session.setPaused("context", contextLost);
    pointer = undefined;
    loop.reset();
    host.suspendAudio(manualPause || !visible || contextLost);
  }
  function restart(): void {
    session.dispose();
    session = new GameSession({
      ...options,
      seed: ((options.seed ?? 1) + ++sessionId * 0x9e3779b9) >>> 0,
      sessionId,
    });
    manualPause = false;
    pointer = undefined;
    for (const view of entityViews.values()) view.destroy({ children: true });
    entityViews.clear();
    for (const effect of effects) effect.view.destroy({ children: true });
    effects.length = 0;
    previous = session.snapshot();
    currentPreview = -1;
    collected.clear();
    collected.add(0);
    pause();
    host.announce("新的一局，拖动选择位置，松手投放");
  }
  function action(value: Action): void {
    if (disposed) return;
    host.unlockAudio();
    if (value === "restart") {
      restart();
      return;
    }
    if (value === "pause") {
      manualPause = !manualPause;
      pause();
      return;
    }
    if (value === "mute") {
      preferences = { ...preferences, muted: !preferences.muted };
      host.setMuted(preferences.muted);
      save();
      return;
    }
    if (value === "left") aim -= 24;
    if (value === "right") aim += 24;
    if (value === "drop") session.drop(aim);
    aim = clampDrop(aim, levelAt(session.snapshot().preview).radius, r);
  }
  function hit(x: number, y: number): Action | undefined {
    if (overlay.visible) {
      if (x >= 215 && x <= 505 && y >= 700 && y <= 758)
        return session.snapshot().status === "gameOver" ? "restart" : "pause";
      if (x >= 215 && x <= 505 && y >= 780 && y <= 838) return "restart";
      return undefined;
    }
    if (y >= 56 && y <= 114) {
      if (x >= 470 && x <= 562) return "pause";
      if (x >= 574 && x <= 674) return "mute";
    }
    return undefined;
  }
  function input(input: Input): void {
    if (input.type === "action") {
      action(input.action);
      return;
    }
    const p = logicalPoint(input.x, input.y, host.viewport());
    if (input.type === "down" && pointer === undefined) {
      host.unlockAudio();
      pointer = input.id;
      pointerButton = hit(p.x, p.y);
      if (!pointerButton && p.y > 200 && p.y < r.floorY && !overlay.visible)
        aim = clampDrop(p.x, levelAt(session.snapshot().preview).radius, r);
      else if (!pointerButton) pointer = undefined;
    }
    if (input.id !== pointer) return;
    if (input.type === "move" && !pointerButton)
      aim = clampDrop(p.x, levelAt(session.snapshot().preview).radius, r);
    if (input.type === "up") {
      if (pointerButton) {
        if (hit(p.x, p.y) === pointerButton) action(pointerButton);
      } else if (p.y >= 200 && p.y <= r.floorY && !overlay.visible)
        session.drop(aim);
      pointer = undefined;
      pointerButton = undefined;
    }
    if (input.type === "cancel") {
      pointer = undefined;
      pointerButton = undefined;
    }
  }
  function event(event: GameEvent): void {
    if (event.sessionId !== sessionId) return;
    host.play(event.type);
    if (event.type === "merge" || event.type === "crown") {
      const view = new Container();
      view.position.set(event.x, event.y);
      view.addChild(
        new Graphics()
          .circle(0, 0, levelAt(event.level).radius + 8)
          .stroke({ color: levelAt(event.level).color, width: 5 }),
      );
      label(`+${event.points}`, 0, -30, 32, TEAL, "center", view);
      effectsView.addChild(view);
      effects.push({ view, life: 0, duration: host.reducedMotion ? 1 : 36 });
      host.announce(
        `合成${levelAt(event.level).name}，当前得分${session.snapshot().score}`,
      );
    }
    if (event.type === "gameOver") {
      host.announce(`本局结束，得分${session.snapshot().score}`);
    }
  }
  function render(alpha: number): void {
    const snap = session.snapshot();
    if (snap.score > preferences.highScore) {
      preferences = { ...preferences, highScore: snap.score };
      save();
    }
    scoreLabel.set(String(snap.score));
    bestLabel.set(String(preferences.highScore));
    muteLabel.set(preferences.muted ? "OFF" : "ON");
    const alive = new Set(snap.entities.map((e) => e.id));
    for (const [id, view] of entityViews)
      if (!alive.has(id)) {
        view.destroy({ children: true });
        entityViews.delete(id);
      }
    const before = new Map(previous.entities.map((e) => [e.id, e]));
    for (const entity of snap.entities) {
      let view = entityViews.get(entity.id);
      if (!view) {
        view = badge(entity.level, levelAt(entity.level).radius);
        entitiesView.addChild(view);
        entityViews.set(entity.id, view);
      }
      const old = before.get(entity.id) ?? entity;
      view.position.set(
        old.x + (entity.x - old.x) * alpha,
        old.y + (entity.y - old.y) * alpha,
      );
      view.rotation = old.angle + (entity.angle - old.angle) * alpha;
      view.alpha =
        entity.overflow > 0 ? 0.65 + 0.35 * Math.sin(snap.tick * 0.15) ** 2 : 1;
      collected.add(entity.level);
    }
    for (const [i, b] of badges.entries()) b.alpha = collected.has(i) ? 1 : 0.2;
    progressLabel.set(`${collected.size} / 11`);
    if (currentPreview !== snap.preview) {
      for (const child of previewView.removeChildren())
        child.destroy({ children: true });
      const view = badge(snap.preview, levelAt(snap.preview).radius);
      previewView.addChild(view);
      currentPreview = snap.preview;
    }
    aim = clampDrop(aim, levelAt(snap.preview).radius, r);
    previewView.position.set(aim, r.spawnY);
    previewView.visible = snap.previewVisible && snap.status !== "gameOver";
    previewView.alpha = snap.canDrop ? 1 : 0.5;
    guide.clear();
    if (snap.canDrop && !overlay.visible)
      for (
        let y = r.spawnY + levelAt(snap.preview).radius + 20;
        y < r.floorY;
        y += 20
      )
        guide.circle(aim, y, 2).fill({ color: TEAL, alpha: 0.25 });
    overlay.visible = snap.status === "paused" || snap.status === "gameOver";
    overlayTitle.set(snap.status === "gameOver" ? "本局结束" : "暂停");
    resumeButton.set(snap.status === "gameOver" ? "再来一次" : "继续游戏");
    overlayDetail.set(
      snap.status === "gameOver"
        ? `本局得分 ${snap.score}`
        : "休息一下，再向上一步",
    );
    let message = "下一颗准备中";
    if (snap.canDrop) message = "拖动徽章，松手投放";
    if (snap.celebration) message = "恭喜获得上应大！";
    topMessage.set(message);
    renderer.render(stage);
  }
  function frame(timestamp: number): void {
    if (disposed) return;
    const snap = session.snapshot();
    const alpha = loop.advance(
      timestamp,
      snap.status === "paused" || snap.status === "gameOver",
      () => {
        previous = session.snapshot();
        session.step();
        for (const e of session.drainEvents()) event(e);
        if (!host.reducedMotion)
          for (let i = effects.length - 1; i >= 0; i--) {
            const effect = effects[i];
            if (!effect) continue;
            effect.life++;
            effect.view.alpha = 1 - effect.life / effect.duration;
            effect.view.scale.set(1 + (effect.life / effect.duration) * 0.25);
            if (effect.life >= effect.duration) {
              effect.view.destroy({ children: true });
              effects.splice(i, 1);
            }
          }
        else {
          for (const effect of effects) effect.view.destroy({ children: true });
          effects.length = 0;
        }
      },
    );
    if (!contextLost) render(alpha);
    frameId = host.requestFrame(frame);
  }
  const stops = [
    host.onInput(input),
    host.onVisibility((value) => {
      visible = value;
      pause();
    }),
    host.onResize(resize),
    host.onContext((lost) => {
      contextLost = lost;
      pause();
      if (!lost) resize();
    }),
  ];
  resize();
  frameId = host.requestFrame(frame);
  host.announce("拖动选择位置，松手投放。相同徽章碰撞升级。");
  return {
    snapshot: () => session.snapshot(),
    action,
    suspend(reason, value) {
      session.setPaused(reason, value);
      pointer = undefined;
      loop.reset();
      host.suspendAudio(session.snapshot().status === "paused");
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      host.cancelFrame(frameId);
      for (const stop of stops) stop();
      session.dispose();
      stage.destroy({ children: true });
      renderer.destroy();
      for (const texture of textures) texture.destroy(true);
      host.dispose();
    },
  };
}
