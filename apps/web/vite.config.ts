import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: process.env.BASE_PATH ?? "./",
  publicDir: fileURLToPath(new URL("../../assets", import.meta.url)),
  resolve: { dedupe: ["pixi.js", "planck"] },
  build: { outDir: process.env.WEB_BUILD_DIR ?? "dist", emptyOutDir: true },
  server: { host: "0.0.0.0" },
  preview: { host: "0.0.0.0", port: 4173 },
});
