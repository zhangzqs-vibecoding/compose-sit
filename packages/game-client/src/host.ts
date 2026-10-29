import type { ICanvas, Texture } from "pixi.js";
import type { Viewport } from "./loop";
export type Action = "pause" | "restart" | "mute" | "left" | "right" | "drop";
export type Input =
  | {
      type: "down" | "move" | "up" | "cancel";
      id: number;
      x: number;
      y: number;
    }
  | { type: "action"; action: Action };
export type Sound = "drop" | "merge" | "crown" | "gameOver";
export interface Host {
  readonly canvas: ICanvas;
  viewport(): Viewport;
  requestFrame(callback: (time: number) => void): number;
  cancelFrame(id: number): void;
  onInput(callback: (input: Input) => void): () => void;
  onVisibility(callback: (visible: boolean) => void): () => void;
  onResize(callback: () => void): () => void;
  onContext(callback: (lost: boolean) => void): () => void;
  loadTexture(path: string): Promise<Texture>;
  loadPreferences(): Promise<unknown>;
  savePreferences(value: unknown): Promise<void>;
  unlockAudio(): void;
  play(sound: Sound): void;
  suspendAudio(suspended: boolean): void;
  setMuted(muted: boolean): void;
  announce(message: string): void;
  readonly reducedMotion: boolean;
  dispose(): void;
}
