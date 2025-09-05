import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['pdfjs-dist'],
    exclude: ['lucide-react'],
  },
  resolve: {
    alias: {
      'pdfjs-dist': 'pdfjs-dist/legacy/build/pdf',
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  preview: {
    port: 5173,
    strictPort: true,
  },
});
