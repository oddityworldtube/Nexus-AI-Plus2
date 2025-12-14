import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: './', 
      server: {
        // 👇 هنا كان سبب المشكلة، قمنا بتغييره ليطابق جوجل كونسول
        port: 5173, 
        strictPort: true, // إضافة مهمة: تمنع تغيير البورت لو كان مشغولاً
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env': JSON.stringify(env)
      },
      resolve: {
        alias: {
          '@': path.resolve('.'),
        }
      },
      build: {
        outDir: 'dist',
        sourcemap: false,
        chunkSizeWarningLimit: 1600,
      }
    };
});