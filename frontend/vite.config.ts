import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Em desenvolvimento, /api é encaminhado para o backend NestJS (porta 3000),
// evitando problemas de CORS. Ajuste BACKEND_URL no .env se necessário.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const backend = env.BACKEND_URL || 'http://localhost:3000';

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy: {
        '/api': { target: backend, changeOrigin: true },
        '/uploads': { target: backend, changeOrigin: true },
      },
    },
  };
});
