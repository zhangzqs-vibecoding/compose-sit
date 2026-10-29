// Evaluate the real IIFE in a minimal no-DOM host. This verifies bootstrap order,
// not a real WebGL implementation or WeChat device support.
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(
  new URL("../apps/wechat/dist/game.js", import.meta.url),
  "utf8",
);
let resolveModal;
const modal = new Promise((resolve) => {
  resolveModal = resolve;
});
const canvas = {
  width: 1,
  height: 1,
  getContext() {
    return null;
  },
};
const context = {
  console,
  setTimeout,
  clearTimeout,
  performance: { now: () => 0 },
  URL,
  URLSearchParams,
  TextEncoder,
  TextDecoder,
  wx: {
    createCanvas: () => ({ ...canvas }),
    getWindowInfo: () => ({
      windowWidth: 390,
      windowHeight: 844,
      pixelRatio: 2,
    }),
    showModal: (options) => resolveModal(options),
  },
  requestAnimationFrame: () => 1,
  cancelAnimationFrame() {},
};
vm.runInNewContext(source, context, { timeout: 5000 });
const result = await Promise.race([
  modal,
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error("No bootstrap result")), 5000),
  ),
]);
if (!/does not support WebGL/.test(result.content))
  throw new Error(`Unexpected bootstrap result: ${result.content}`);
console.log(
  "No-DOM IIFE bootstrap reaches the expected unavailable-GPU error:",
  result.content,
);
