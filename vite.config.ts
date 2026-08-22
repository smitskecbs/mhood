import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { verifiedBurnsPlugin } from './server/viteVerifiedBurnsPlugin';

export default defineConfig({
  plugins: [react(), verifiedBurnsPlugin()],
  define: {
    'process.env': {},
    global: 'globalThis',
  },
  resolve: {
    alias: {
      buffer: 'buffer',
    },
  },
  optimizeDeps: {
    include: ['buffer', '@solana/web3.js', '@solana/spl-token'],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
});
