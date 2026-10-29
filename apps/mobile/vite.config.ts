import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "./",
  publicDir: fileURLToPath(new URL("../../assets", import.meta.url)),
  resolve: { dedupe: ["pixi.js", "planck"] },
  build: { outDir: "dist", emptyOutDir: true },
});
