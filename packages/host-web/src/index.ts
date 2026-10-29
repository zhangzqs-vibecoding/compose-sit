import type { Action, Host, Sound } from "@compose-sit/game-client";
import { Assets, type Texture } from "pixi.js";
import assetManifest from "../../../assets/manifest.json";
export interface WebHostOptions {
  readonly baseUrl: string;
  readonly canvas: HTMLCanvasElement;
  readonly container: HTMLElement;
  readonly announce?: (text: string) => void;
  readonly loadPreferences?: () => Promise<unknown>;
  readonly savePreferences?: (value: unknown) => Promise<void>;
}
export function createWebHost(options: WebHostOptions): Host {
  const { canvas, container } = options;
  let audio: AudioContext | undefined;
  let muted = false,
    suspended = false,
    disposed = false;
  let master: GainNode | undefined;
  let voices = 0;
  const assetPaths = new Set<string>();
  const buffers = new Map<Sound, AudioBuffer>();
  const pending = new Map<Sound, Promise<ArrayBuffer>>();
  for (const sound of ["drop", "merge", "crown", "gameOver"] as const)
    pending.set(
      sound,
      fetch(`${options.baseUrl}${assetManifest.sounds[sound]}`)
        .then((r) => {
          if (!r.ok) throw new Error("Audio unavailable");
          return r.arrayBuffer();
        })
        .catch(() => new ArrayBuffer(0)),
    );
  function unlockAudio(): void {
    if (disposed) return;
    if (!audio) {
      try {
        audio = new AudioContext();
        master = audio.createGain();
        master.gain.value = muted ? 0 : 0.22;
        master.connect(audio.destination);
      } catch {
        return;
      }
      for (const [sound, promise] of pending)
        void promise.then(async (data) => {
          if (!data.byteLength || disposed || !audio) return;
          try {
            const buffer = await audio.decodeAudioData(data);
            if (!disposed) buffers.set(sound, buffer);
          } catch {
            /* Audio remains optional. */
          }
        });
    }
    if (!suspended) void audio.resume().catch(() => {});
  }
  function play(sound: Sound): void {
    if (!audio || !master || muted || suspended || voices >= 6) return;
    const buffer = buffers.get(sound);
    if (!buffer) return;
    const source = audio.createBufferSource();
    const gain = audio.createGain();
    source.buffer = buffer;
    gain.gain.value = 1;
    source.connect(gain);
    gain.connect(master);
    voices++;
    source.onended = () => {
      voices--;
      source.disconnect();
      gain.disconnect();
    };
    source.start();
  }
  return {
    canvas,
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    viewport: () => {
      const rect = canvas.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
        pixelRatio: devicePixelRatio || 1,
      };
    },
    requestFrame: (callback) => requestAnimationFrame(callback),
    cancelFrame: (id) => cancelAnimationFrame(id),
    onInput(callback) {
      function pointer(event: PointerEvent): void {
        event.preventDefault();
        const rect = canvas.getBoundingClientRect();
        let type: "down" | "move" | "up" | "cancel" = "cancel";
        switch (event.type) {
          case "pointerdown":
            type = "down";
            break;
          case "pointermove":
            type = "move";
            break;
          case "pointerup":
            type = "up";
            break;
        }

        if (type === "down") canvas.setPointerCapture(event.pointerId);
        callback({
          type,
          id: event.pointerId,
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        });
      }
      function lost(event: PointerEvent): void {
        callback({ type: "cancel", id: event.pointerId, x: 0, y: 0 });
      }
      const keys: Record<string, Action> = {
        ArrowLeft: "left",
        ArrowRight: "right",
        " ": "drop",
        Escape: "pause",
        p: "pause",
        m: "mute",
      };
      function key(event: KeyboardEvent): void {
        const action = keys[event.key];
        if (action && !event.repeat) {
          event.preventDefault();
          callback({ type: "action", action });
        }
      }
      for (const event of [
        "pointerdown",
        "pointermove",
        "pointerup",
        "pointercancel",
      ])
        canvas.addEventListener(event, pointer as EventListener);
      canvas.addEventListener("lostpointercapture", lost);
      window.addEventListener("keydown", key);
      return () => {
        for (const event of [
          "pointerdown",
          "pointermove",
          "pointerup",
          "pointercancel",
        ])
          canvas.removeEventListener(event, pointer as EventListener);
        canvas.removeEventListener("lostpointercapture", lost);
        window.removeEventListener("keydown", key);
      };
    },
    onVisibility(callback) {
      function update(): void {
        callback(document.visibilityState !== "hidden" && document.hasFocus());
      }
      function blur(): void {
        callback(false);
      }
      function focus(): void {
        callback(document.visibilityState !== "hidden");
      }
      document.addEventListener("visibilitychange", update);
      window.addEventListener("blur", blur);
      window.addEventListener("focus", focus);
      callback(document.visibilityState !== "hidden");
      return () => {
        document.removeEventListener("visibilitychange", update);
        window.removeEventListener("blur", blur);
        window.removeEventListener("focus", focus);
      };
    },
    onResize(callback) {
      const observer = new ResizeObserver(callback);
      observer.observe(container);
      return () => observer.disconnect();
    },
    onContext(callback) {
      function lost(event: Event): void {
        event.preventDefault();
        callback(true);
      }
      function restored(): void {
        callback(false);
      }
      canvas.addEventListener("webglcontextlost", lost);
      canvas.addEventListener("webglcontextrestored", restored);
      return () => {
        canvas.removeEventListener("webglcontextlost", lost);
        canvas.removeEventListener("webglcontextrestored", restored);
      };
    },
    loadTexture: (path) => {
      const url = `${options.baseUrl}${path}`;
      assetPaths.add(url);
      return Assets.load<Texture>(url);
    },
    async loadPreferences() {
      if (options.loadPreferences) return options.loadPreferences();
      try {
        return JSON.parse(
          localStorage.getItem("compose-sit:preferences") ?? "null",
        );
      } catch {
        return null;
      }
    },
    async savePreferences(value) {
      if (options.savePreferences) return options.savePreferences(value);
      localStorage.setItem("compose-sit:preferences", JSON.stringify(value));
    },
    unlockAudio,
    play,
    suspendAudio(value) {
      suspended = value;
      if (audio)
        void (value ? audio.suspend() : audio.resume()).catch(() => {});
    },
    setMuted(value) {
      muted = value;
      if (master && audio)
        master.gain.setValueAtTime(muted ? 0 : 0.22, audio.currentTime);
    },
    announce: (text) => options.announce?.(text),
    dispose() {
      for (const url of assetPaths) Assets.cache.remove(url);
      assetPaths.clear();
      disposed = true;
      if (audio) void audio.close().catch(() => {});
      buffers.clear();
    },
  };
}
