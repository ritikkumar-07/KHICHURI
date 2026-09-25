import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Listens on all local IPs (0.0.0.0)
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5000',
      '/socket.io': 'http://localhost:5000'
    },
    // SPA fallback: any unknown path serves index.html so React Router takes over
    historyApiFallback: true
  },
  build: { outDir: 'dist' }
});
