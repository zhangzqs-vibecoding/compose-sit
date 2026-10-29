import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  publicDir: false,
  resolve: {
    dedupe: ["pixi.js", "planck"],
    alias: {
      "@compose-sit/pixi-environment": fileURLToPath(
        new URL(
          "node_modules/pixi.js/lib/environment/adapter.mjs",
          import.meta.url,
        ),
      ),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2020",
    modulePreload: false,
    lib: {
      entry: fileURLToPath(new URL("src/main.ts", import.meta.url)),
      name: "ComposeSIT",
      formats: ["iife"],
      fileName: () => "game.js",
    },
    rolldownOptions: { output: { codeSplitting: false } },
  },
});
