import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
const backEndPort = process.env.PORT || 3001;
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3002,
    proxy: {
      '/api': {
        target:      `http://localhost:${backEndPort}`,
        changeOrigin: true,
        secure:      false,
      },
      '/health': {
        target:      `http://localhost:${backEndPort}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
