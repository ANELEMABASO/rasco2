import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    // Local dev: forward /api to the FastAPI gateway (backend/api.py, default :8000).
    // Not used on Vercel, where VITE_API_BASE points straight at the deployed backend.
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:8000',
        changeOrigin: true,
        timeout: 120_000,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 900,
  },
});
