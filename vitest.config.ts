import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "apps/wechat/**/*.test.ts"],
    environment: "node",
  },
});
