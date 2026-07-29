import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    proxy: {
      // Wallet/settlement server (npm run server). If it isn't running, these
      // requests fail fast and the client falls back to local computation —
      // see src/utils/apiClient.ts.
      '/api': {
        target: 'http://localhost:4400',
        changeOrigin: true,
      },
    },
  },
});
