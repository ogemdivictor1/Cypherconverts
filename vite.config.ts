import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [react()],

    // 🔹 Dev server (local)
    server: {
      port: 3000,
      host: '0.0.0.0',
    },

    // 🔹 Preview server (Render uses this)
    preview: {
      host: true,
      port: Number(process.env.PORT) || 4173,
      allowedHosts: [
        'cypherconverts.onrender.com'
      ]
    },

    // 🔹 Environment variables
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },

    // 🔹 Path alias
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});