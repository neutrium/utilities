import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['tests/**/*.test.mjs', 'src/**/tests/**/*.test.mjs'],
        typecheck: {
            enabled: true,
            tsconfig: './tsconfig.tests.json',
            include: ['tests/**/*.test-d.ts', 'src/**/tests/**/*.test-d.ts'],
        },
    },
});
