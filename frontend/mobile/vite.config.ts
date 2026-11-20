import { defineConfig, type Plugin } from 'vite';
import uni from '@dcloudio/vite-plugin-uni';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET?.trim() || 'http://127.0.0.1:9999';

function portableH5Chunks(): Plugin {
  return { name: 'portable-h5-chunk-names', apply: 'build', outputOptions(output) {
    if (process.env.UNI_PLATFORM !== 'h5' || !output.chunkFileNames) return;
    const original = output.chunkFileNames;
    return { ...output, chunkFileNames(chunk) {
      const fileName = typeof original === 'function' ? original(chunk) : original;
      // Uni names modules outside src as "..-..-node_modules-...". Rollup treats
      // that leading ".." as relative and omits "./", yielding a bare import.
      return fileName.replace(/(^|\/)(\.\.-)/g, '$1external-$2');
    } };
  } };
}

export default defineConfig({ plugins: [uni(), portableH5Chunks(), { name: 'release-metadata', generateBundle() {
  this.emitFile({ type: 'asset', fileName: 'release.json', source: JSON.stringify({ version: readFileSync(resolve(__dirname, '../../VERSION'), 'utf8').trim(), target: process.env.UNI_PLATFORM, demo: false }) });
} }], build: { emptyOutDir: true }, resolve: { dedupe: ['vue', '@vue/reactivity', '@vue/runtime-core', '@vue/runtime-dom', '@vue/shared'] }, server: { host: '127.0.0.1', port: 8890, proxy: { '/api': { target: apiProxyTarget, changeOrigin: false, rewrite: p => p.replace(/^\/api/, '') } } } });
