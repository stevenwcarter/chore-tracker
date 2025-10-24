import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import eslint from 'vite-plugin-eslint';
import viteTsconfigPaths from 'vite-tsconfig-paths';
import svgrPlugin from 'vite-plugin-svgr';
import compress from 'vite-plugin-compression2';
import tailwindcss from '@tailwindcss/vite';

const PROXY_ENDPOINT = 'http://localhost:7007';

export default defineConfig(() => {
  return {
    build: {
      outDir: 'build',
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./setupVitest.ts'],
      coverage: {
        reporter: ['text', 'html', 'cobertura', 'lcov', 'json-summary'],
        exclude: [
          '**/node_modules/**',
          '**/build/**',
          '**/*.js',
          '**/*.jsx',
          '**/*.cjs',
          '**/*.mjs',
          'src/main.tsx',
        ],
      },
    },
    plugins: [react(), eslint(), viteTsconfigPaths(), svgrPlugin(), tailwindcss(), compress()],
    server: {
      watch: {
        ignored: ['coverage', 'build'],
      },
      proxy: {
        '/auth/': {
          target: PROXY_ENDPOINT,
          changeOrigin: true,
          secure: false,
        },
        '/images/': {
          target: PROXY_ENDPOINT,
          changeOrigin: true,
          secure: false,
        },
        '/api/': {
          target: PROXY_ENDPOINT,
          changeOrigin: true,
          secure: false,
        },
        '/graphql': {
          target: PROXY_ENDPOINT,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
