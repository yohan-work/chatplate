import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        customer: 'index.html',
        admin: 'admin/index.html',
      },
    },
  },
});
