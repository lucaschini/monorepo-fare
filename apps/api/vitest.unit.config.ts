import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["src/routes/__tests__/**/*.test.ts"],
    fileParallelism: false,
  },
});
