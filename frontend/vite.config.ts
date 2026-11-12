import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import { readFileSync } from 'fs';

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET?.trim() || 'http://127.0.0.1:9999';
function demoAssets(): Plugin {
	return { name: 'isolated-pages-demo', generateBundle() {
		const version = readFileSync(resolve(__dirname, '../VERSION'), 'utf8').trim();
		for (const file of ['demo-worker.js', 'demo-runtime.mjs', 'demo-extensions.mjs']) this.emitFile({ type: 'asset', fileName: file, source: readFileSync(resolve(__dirname, 'demo', file), 'utf8').replaceAll('__DEMO_VERSION__', version) });
		this.emitFile({ type: 'asset', fileName: '.nojekyll', source: '' });
	} };
}

export default defineConfig(({ mode }) => ({
	plugins: [vue(), { name: 'release-metadata', generateBundle() {
		this.emitFile({ type: 'asset', fileName: 'release.json', source: JSON.stringify({ version: readFileSync(resolve(__dirname, '../VERSION'), 'utf8').trim(), target: 'web', demo: mode === 'demo' }) });
	} }, ...(mode === 'demo' ? [demoAssets()] : [])],
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
	build: { chunkSizeWarningLimit: 1500, outDir: mode === 'demo' ? 'dist-demo' : 'dist' },
}));
