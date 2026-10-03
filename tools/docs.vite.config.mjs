import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// Preview the generated documentation under its GitHub Pages path.
export default defineConfig({
    base: '/utilities/',
    appType: 'mpa',
    build: {
        outDir: fileURLToPath(new URL('../docs', import.meta.url)),
    },
    preview: {
        host: '127.0.0.1',
        port: 4173,
        strictPort: true,
    },
});
