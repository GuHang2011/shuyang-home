import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET?.trim() || 'http://127.0.0.1:9999';

export default defineConfig({
	plugins: [vue()],
	resolve: { alias: { '@': resolve(__dirname, 'src'), '/@': resolve(__dirname, 'src') } },
	base: './',
	server: {
		host: '127.0.0.1',
		port: 8888,
		proxy: { '/api': { target: apiProxyTarget, changeOrigin: false, rewrite: (path) => path.replace(/^\/api/, '') } },
	},
	build: { chunkSizeWarningLimit: 1500 },
});
