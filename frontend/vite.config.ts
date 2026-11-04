import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET?.trim() || 'http://127.0.0.1:9999';

export default defineConfig({
	plugins: [vue()],
	define: { __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false },
	resolve: {
		alias: [
			{ find: '@', replacement: resolve(__dirname, 'src') },
			{ find: '/@', replacement: resolve(__dirname, 'src') },
			// WebScanner uses only the QR reader. Native classes let Rollup remove
			// unused barcode formats; Vite still applies the existing browser target.
			{ find: /^@zxing\/browser$/, replacement: resolve(__dirname, 'node_modules/@zxing/browser/es2015/readers/BrowserQRCodeReader.js') },
			{ find: /^@zxing\/library$/, replacement: resolve(__dirname, 'node_modules/@zxing/library/es2015/index.js') },
		],
	},
	base: './',
	server: {
		host: '127.0.0.1',
		port: 8888,
		proxy: { '/api': { target: apiProxyTarget, changeOrigin: false, rewrite: (path) => path.replace(/^\/api/, '') } },
	},
	build: { chunkSizeWarningLimit: 1500 },
});
