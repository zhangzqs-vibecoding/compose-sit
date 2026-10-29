import { createGame } from "../../../packages/game-client/src/index";
import { DEFAULT_RULES } from "../../../packages/game-core/src/index";
import { createWebHost } from "../../../packages/host-web/src/index";

const canvas = document.querySelector("canvas"),
  container = document.querySelector<HTMLElement>("#game");
if (!canvas || !container) throw new Error("Missing fixture mount");
const host = createWebHost({
  canvas,
  container,
  baseUrl: import.meta.env.BASE_URL,
  announce: (text) => {
    const node = document.querySelector("#announcement");
    if (node) node.textContent = text;
  },
});
await createGame(host, {
  rules: { ...DEFAULT_RULES, dangerY: 1120, overflowTicks: 12 },
  initialEntities: [{ level: 1, x: 360, y: DEFAULT_RULES.floorY - 39 }],
});
document.querySelector<HTMLElement>("#status")?.setAttribute("hidden", "");
