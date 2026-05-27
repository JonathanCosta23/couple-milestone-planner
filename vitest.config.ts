import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Encerramento determinístico: limpa mocks e DOM entre testes,
    // usa pool de forks com paralelismo controlado e timeout de teardown
    // baixo para evitar processos pendurados em CI.
    clearMocks: true,
    restoreMocks: true,
    mockReset: false,
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: false,
        maxForks: 2,
        minForks: 1,
      },
    },
    teardownTimeout: 5000,
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
