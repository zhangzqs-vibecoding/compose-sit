import "./environment";
import {
  createGame,
  type Host,
  type Input,
  type Sound,
} from "@compose-sit/game-client";
import { ImageSource, Texture } from "pixi.js";
import assetManifest from "../../../assets/manifest.json";

import { canvas, mainSurface, windowInfo } from "./environment";

let visible = true,
  muted = false;
const audio = new Set<WechatMinigame.InnerAudioContext>();
let width = windowInfo.windowWidth,
  height = windowInfo.windowHeight;
const contextCallbacks = new Set<(lost: boolean) => void>();
let contextLost = false;
function touch(
  type: "down" | "move" | "up" | "cancel",
  callback: (input: Input) => void,
): (event: WechatMinigame.OnTouchStartListenerResult) => void {
  return (event) => {
    for (const t of event.changedTouches)
      callback({ type, id: t.identifier, x: t.clientX, y: t.clientY });
  };
}
const host: Host = {
  canvas: mainSurface.canvas,
  reducedMotion: false,
  viewport: () => ({ width, height, pixelRatio: windowInfo.pixelRatio }),
  requestFrame: (callback) =>
    requestAnimationFrame((time) => {
      const lost = canvas.getContext("webgl").isContextLost();
      if (lost !== contextLost) {
        contextLost = lost;
        mainSurface.contextChanged(lost);
        for (const cb of contextCallbacks) cb(lost);
      }
      callback(time);
    }),
  cancelFrame: (id) => cancelAnimationFrame(id),
  onInput(callback) {
    const start = touch("down", callback),
      move = touch("move", callback),
      end = touch("up", callback),
      cancel = touch("cancel", callback);
    wx.onTouchStart(start);
    wx.onTouchMove(move);
    wx.onTouchEnd(end);
    wx.onTouchCancel(cancel);
    return () => {
      wx.offTouchStart(start);
      wx.offTouchMove(move);
      wx.offTouchEnd(end);
      wx.offTouchCancel(cancel);
    };
  },
  onVisibility(callback) {
    const hide = () => {
      visible = false;
      callback(false);
    };
    const show = () => {
      visible = true;
      callback(true);
    };
    wx.onHide(hide);
    wx.onShow(show);
    return () => {
      wx.offHide(hide);
      wx.offShow(show);
    };
  },
  onResize(callback) {
    const resize = (event: WechatMinigame.OnWindowResizeListenerResult) => {
      width = event.windowWidth;
      height = event.windowHeight;
      callback();
    };
    wx.onWindowResize(resize);
    return () => wx.offWindowResize(resize);
  },
  onContext(callback) {
    contextCallbacks.add(callback);
    return () => {
      contextCallbacks.delete(callback);
    };
  },
  loadTexture: (path) =>
    new Promise((resolve, reject) => {
      const image = wx.createImage();
      image.onload = () =>
        resolve(
          new Texture({
            source: new ImageSource({
              resource: image as unknown as HTMLImageElement,
            }),
          }),
        );
      image.onerror = reject;
      image.src = `assets/${path}`;
    }),
  loadPreferences: async () => {
    try {
      return wx.getStorageSync("compose-sit:preferences");
    } catch {
      return null;
    }
  },
  savePreferences: async (value) => {
    wx.setStorageSync("compose-sit:preferences", value);
  },
  unlockAudio() {},
  play(sound: Sound) {
    if (muted || !visible || audio.size >= 6) return;
    const voice = wx.createInnerAudioContext();
    audio.add(voice);
    const done = () => {
      audio.delete(voice);
      voice.destroy();
    };
    voice.onEnded(done);
    voice.onError(done);
    voice.src = `assets/${assetManifest.sounds[sound]}`;
    voice.volume = 0.35;
    voice.play();
  },
  suspendAudio(value) {
    if (value)
      for (const voice of audio) {
        voice.destroy();
      }
    if (value) audio.clear();
  },
  setMuted(value) {
    muted = value;
    if (value) {
      for (const voice of audio) voice.destroy();
      audio.clear();
    }
  },
  announce() {},
  dispose() {
    for (const voice of audio) voice.destroy();
    audio.clear();
  },
};
void createGame(host, { seed: Date.now() >>> 0 }).catch((error) => {
  wx.showModal({
    title: "游戏加载失败",
    content: error instanceof Error ? error.message : "请重新打开游戏",
    showCancel: false,
  });
});
