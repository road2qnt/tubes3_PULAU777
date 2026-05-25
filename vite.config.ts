import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync } from 'fs';

// Plugin untuk flatten HTML output ke dist/
function flattenHtmlPlugin() {
  return {
    name: 'flatten-html',
    closeBundle() {
      try {
        mkdirSync(resolve(__dirname, 'dist'), { recursive: true });
        copyFileSync(
          resolve(__dirname, 'dist/src/popup/popup.html'),
          resolve(__dirname, 'dist/popup.html')
        );
      } catch {
        // file might not exist on first pass
      }
    },
  };
}

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        content: resolve(__dirname, 'src/content/content.ts'),
        popup: resolve(__dirname, 'src/popup/popup.html'),
        background: resolve(__dirname, 'src/background/background.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
    target: 'es2022',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  publicDir: 'public',
  plugins: [flattenHtmlPlugin()],
});
