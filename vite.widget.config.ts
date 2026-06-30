import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    emptyOutDir: false,
    cssCodeSplit: true,
    lib: {
      entry: 'src/widget-entry.tsx',
      name: 'ChatplateBundle',
      formats: ['iife'],
      fileName: () => 'widget.js',
    },
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => (assetInfo.name === 'style.css' ? 'widget.css' : '[name][extname]'),
      },
    },
  },
});
