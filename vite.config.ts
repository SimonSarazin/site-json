import path from 'path';
import tailwindcss from "@tailwindcss/vite"
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(({ mode, isSsrBuild }) => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(mode),
  },
  build: {
    rollupOptions: isSsrBuild ? {
      input: 'src/entry-server.tsx',
      output: {
        format: 'es'
      }
    } : undefined
  },
  ssr: {
    noExternal: ['@radix-ui/', 'lucide-react'],
    external: ['express', 'compression', 'serve-static', '@communecter/cocolight-api-client']
  }
}));