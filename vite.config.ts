/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
  ],

  resolve: {
    alias: {
      '@': path.resolve(rootDir, './src'),
    },
  },

  build: {
    chunkSizeWarningLimit: 1500,

    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return;

          if (
            /[\\/]node_modules[\\/](react|react-dom|react-router-dom)[\\/]/.test(
              id,
            )
          ) {
            return 'vendor-react';
          }

          if (
            /[\\/]node_modules[\\/](@tanstack[\\/]react-query|axios)[\\/]/.test(
              id,
            )
          ) {
            return 'vendor-data';
          }

          if (
            /[\\/]node_modules[\\/](react-hook-form|@hookform[\\/]resolvers|zod)[\\/]/.test(
              id,
            )
          ) {
            return 'vendor-form';
          }

          if (/[\\/]node_modules[\\/](antd|@ant-design)[\\/]/.test(id)) {
            return 'vendor-antd';
          }

          if (/[\\/]node_modules[\\/].*rc-/.test(id)) {
            return 'vendor-rc';
          }

          if (/[\\/]node_modules[\\/]@emotion[\\/]/.test(id)) {
            return 'vendor-emotion';
          }

          if (/[\\/]node_modules[\\/]dayjs[\\/]/.test(id)) {
            return 'vendor-dayjs';
          }

          if (/[\\/]node_modules[\\/](lodash|uuid)[\\/]/.test(id)) {
            return 'vendor-utils';
          }

          return 'vendor';
        },
      },
    },
  },
});
