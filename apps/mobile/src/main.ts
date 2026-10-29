import { App } from "@capacitor/app";
import { Preferences } from "@capacitor/preferences";
import { createGame, type Game } from "@compose-sit/game-client";
import { createWebHost } from "@compose-sit/host-web";

declare global {
  interface Window {
    __composeSitReplay?: () => ReturnType<Game["exportReplay"]> | undefined;
  }
}

const canvas = document.querySelector("canvas"),
  container = document.querySelector<HTMLElement>("#game");
if (!canvas || !container) throw new Error("Missing game mount");
const host = createWebHost({
  canvas,
  container,
  baseUrl: import.meta.env.BASE_URL,
  loadPreferences: async () => {
    const { value } = await Preferences.get({ key: "compose-sit:preferences" });
    try {
      return JSON.parse(value ?? "null");
    } catch {
      return null;
    }
  },
  savePreferences: async (value) =>
    Preferences.set({
      key: "compose-sit:preferences",
      value: JSON.stringify(value),
    }),
});
try {
  const game = await createGame(host, {
    seed: crypto.getRandomValues(new Uint32Array(1))[0] ?? 1,
  });
  window.__composeSitReplay = () => game.exportReplay();
  document.querySelector("#status")?.remove();
  const state = await App.addListener("appStateChange", ({ isActive }) => {
    game.suspend("native-background", !isActive);
  });
  const back = await App.addListener("backButton", () => {
    if (game.snapshot().status !== "paused") game.action("pause");
  });
  if (import.meta.hot)
    import.meta.hot.dispose(() => {
      game.dispose();
      delete window.__composeSitReplay;
      void state.remove();
      void back.remove();
    });
} catch (error) {
  const status = document.querySelector("#status");
  if (status) status.textContent = "加载失败，请重新打开游戏";
  console.error(error);
}
