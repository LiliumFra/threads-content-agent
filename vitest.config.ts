import { defineConfig } from "vitest/config";

// CI builds dist/ before running tests. Do not execute compiled duplicate
// *.test.js files alongside the authoritative TypeScript test sources.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"]
  }
});
