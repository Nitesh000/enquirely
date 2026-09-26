import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * Unit tests for `lib/` --- pure logic, no DOM, no database.
 *
 * The form engine (M1) is the main customer here: it is deliberately written
 * as pure functions so it can be tested exhaustively without React.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "lib/**/*.test.tsx"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": import.meta.dirname,
    },
  },
});
