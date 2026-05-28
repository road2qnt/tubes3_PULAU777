import { defineConfig, build } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, rmSync, cpSync } from 'fs';

function extensionPlugin() {
  return {
    name: 'extension-plugin',
    closeBundle() {
      try {
        mkdirSync(resolve(__dirname, 'dist'), { recursive: true });
        copyFileSync(
          resolve(__dirname, 'dist/src/popup/popup.html'),
          resolve(__dirname, 'dist/popup.html')
        );
      } catch {
      }

      try {
        cpSync(resolve(__dirname, 'src/algorithms'), resolve(__dirname, 'dist/algorithms'), { recursive: true });
      } catch {
      }
    },
  };
}

const isSubBuild = process.env.SUB_BUILD === 'true';

export default defineConfig(async ({ command }) => {
  const resolveConfig = {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  };

  if (command === 'build' && !isSubBuild) {
    process.env.SUB_BUILD = 'true';
    
    try {
      rmSync(resolve(__dirname, 'dist'), { recursive: true, force: true });
    } catch {}
    
    await build({
      configFile: false,
      resolve: resolveConfig,
      build: {
        outDir: 'dist',
        emptyOutDir: false,
        target: 'es2022',
        sourcemap: true,
        rollupOptions: {
          input: resolve(__dirname, 'src/background/background.ts'),
          output: { entryFileNames: 'background.js' }
        }
      }
    });

    await build({
      configFile: false,
      resolve: resolveConfig,
      build: {
        outDir: 'dist',
        emptyOutDir: false,
        target: 'es2022',
        sourcemap: true,
        rollupOptions: {
          input: resolve(__dirname, 'src/content/content.ts'),
          output: { 
            entryFileNames: 'content.js',
            assetFileNames: 'assets/[name].[ext]'
          }
        }
      }
    });
  }

  return {
    resolve: resolveConfig,
    publicDir: !isSubBuild ? 'public' : false,
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      target: 'es2022',
    sourcemap: true,
      rollupOptions: {
        input: {
          popup: resolve(__dirname, 'src/popup/popup.html'),
        },
        output: {
          entryFileNames: '[name].js',
          chunkFileNames: 'chunks/[name]-[hash].js',
          assetFileNames: 'assets/[name].[ext]',
        },
      },
    },
    plugins: [extensionPlugin()],
  };
});
