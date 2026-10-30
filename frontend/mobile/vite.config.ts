import { defineConfig } from 'vite';
import uni from '@dcloudio/vite-plugin-uni';

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET?.trim() || 'http://127.0.0.1:9999';

export default defineConfig({ plugins: [uni()], resolve: { dedupe: ['vue', '@vue/reactivity', '@vue/runtime-core', '@vue/runtime-dom', '@vue/shared'] }, server: { host: '127.0.0.1', port: 8890, proxy: { '/api': { target: apiProxyTarget, changeOrigin: false, rewrite: p => p.replace(/^\/api/, '') } } } });
