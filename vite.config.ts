import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(({ command, ssrBuild }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    rollupOptions: ssrBuild ? {
      input: 'src/entry-server.tsx',
      output: {
        format: 'es'
      }
    } : {
      input: 'index.html'
    }
  },
  ssr: {
    noExternal: ['react', 'react-dom']
  }
}));
