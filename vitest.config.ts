import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        // Test files verify behavior and are not application logic.
        'src/**/*.test.ts',
        // Type declarations contain no executable application logic.
        'src/**/*.d.ts',
      ],
    },
  },
});
