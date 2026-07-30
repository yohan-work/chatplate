import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    emptyOutDir: false,
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        widget: 'src/widget-loader.ts',
      },
      output: {
        entryFileNames: 'widget.js',
        chunkFileNames: 'widget-[name]-[hash].js',
        assetFileNames: (assetInfo) => (assetInfo.name === 'style.css' ? 'widget.css' : '[name][extname]'),
      },
    },
  },
});
