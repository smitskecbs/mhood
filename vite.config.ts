import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { moginhoodApiPlugin } from './server/viteVerifiedBurnsPlugin';

export default defineConfig(({ mode }) => ({
  plugins: [react(), moginhoodApiPlugin()],
  define: {
    'process.env': {},
    global: 'globalThis',
    ...(mode === 'production' ? { 'import.meta.env.VITE_SOLANA_RPC_URL': JSON.stringify('') } : {}),
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
}));
