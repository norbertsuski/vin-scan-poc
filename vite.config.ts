import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/vin-scan-poc/',
  plugins: [react()]
});
