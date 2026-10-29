import { createGame, type Game } from "@compose-sit/game-client";
import { createWebHost } from "@compose-sit/host-web";
import "./style.css";

declare global {
  interface Window {
    __composeSitReplay?: () => ReturnType<Game["exportReplay"]> | undefined;
  }
}

const container = document.querySelector<HTMLElement>("#game");
const canvas = document.querySelector<HTMLCanvasElement>("canvas");
const status = document.querySelector<HTMLElement>("#status");
const announcement = document.querySelector<HTMLElement>("#announcement");
if (!container || !canvas || !status) throw new Error("Missing game mount");
let game: Game | undefined;
let disposed = false;
window.__composeSitReplay = () => game?.exportReplay();
const host = createWebHost({
  baseUrl: import.meta.env.BASE_URL,
  container,
  canvas,
  announce: (text) => {
    if (announcement) announcement.textContent = text;
  },
});
try {
  game = await createGame(host, {
    seed: crypto.getRandomValues(new Uint32Array(1))[0] ?? 1,
  });
  if (disposed) game.dispose();
  else {
    status.hidden = true;
    canvas.focus();
  }
} catch (error) {
  status.textContent = "游戏加载失败，请检查图形加速或刷新重试。";
  const retry = document.createElement("button");
  retry.textContent = "重新加载";
  retry.onclick = () => location.reload();
  status.append(retry);
  console.error(error);
}
for (const button of document.querySelectorAll<HTMLButtonElement>(
  "[data-action]",
))
  button.addEventListener("click", () => {
    const action = button.dataset.action;
    if (action === "pause" || action === "mute" || action === "restart")
      game?.action(action);
  });
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    disposed = true;
    delete window.__composeSitReplay;
    game?.dispose();
  });
