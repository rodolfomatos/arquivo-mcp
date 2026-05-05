import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    timeout: 30000, // 30 seconds for integration tests
    hookTimeout: 31000,
  },
});
