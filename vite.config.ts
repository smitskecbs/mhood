import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { moginhoodApiPlugin } from './server/viteVerifiedBurnsPlugin.js';

export default defineConfig(({ mode }) => ({
  plugins: [react(), moginhoodApiPlugin()],
  define: {
    'process.env': {},
    global: 'globalThis',
    ...(mode === 'production'
      ? {
          // Neutralize only the secret RPC URL. Public protocol config such as
          // VITE_MHOOD_MINT must remain available in the client bundle.
          'import.meta.env.VITE_SOLANA_RPC_URL': JSON.stringify(''),
        }
      : {}),
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
