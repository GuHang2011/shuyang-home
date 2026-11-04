// Build the existing Web production target and report reproducible byte counts.
// All measurements are local outputs; no production data or credentials are read.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { gzipSync } = require('node:zlib');
const { performance } = require('node:perf_hooks');
const root = path.resolve(__dirname, '..');
const label = process.argv[2] || 'current';
if (!/^[a-z0-9-]+$/.test(label)) throw new Error('Use a lowercase measurement label.');
const output = path.join(root, 'output', 'bundle-size', label);
if (fs.existsSync(output)) throw new Error('Measurement already exists; choose a new label.');
fs.mkdirSync(output, { recursive: true });
const started = performance.now();
const buildArgs = ['run', 'build', '--', '--outDir', '../output/bundle-size/' + label + '/dist', '--emptyOutDir'];
const build = spawnSync(process.platform === 'win32' ? 'cmd.exe' : 'npm', process.platform === 'win32' ? ['/d', '/s', '/c', 'npm ' + buildArgs.join(' ')] : buildArgs, {
  cwd: path.join(root, 'frontend'), encoding: 'utf8', maxBuffer: 8 * 1024 * 1024
});
const seconds = Number(((performance.now() - started) / 1000).toFixed(3));
fs.writeFileSync(path.join(output, 'build.log'), (build.stdout || '') + (build.stderr || ''));
if (build.error || build.status !== 0) throw build.error || new Error('Build failed; see ' + path.join(output, 'build.log'));
const dist = path.join(output, 'dist');
const entries = [];
function walk(directory) {
  for (const name of fs.readdirSync(directory)) {
    const file = path.join(directory, name);
    if (fs.statSync(file).isDirectory()) walk(file);
    else {
      const bytes = fs.readFileSync(file);
      entries.push({ file: path.relative(dist, file).replaceAll('\\', '/'), bytes: bytes.length, gzipBytes: gzipSync(bytes, { level: 9 }).length });
    }
  }
}
walk(dist);
entries.sort((a, b) => b.bytes - a.bytes || a.file.localeCompare(b.file));
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const linked = new Set(Array.from(html.matchAll(/(?:src|href)="\.\/([^"?#]+)"/g), match => match[1]));
const sum = rows => ({ bytes: rows.reduce((n, row) => n + row.bytes, 0), gzipBytes: rows.reduce((n, row) => n + row.gzipBytes, 0) });
const runtime = entries.filter(row => /\.(js|css)$/.test(row.file));
const initial = runtime.filter(row => linked.has(row.file));
const report = { label, node: process.version, version: fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim(), buildSeconds: seconds,
  compression: 'gzip level 9, sum of independently compressed files; transfer estimate, not a network timing',
  initialDefinition: 'JS/CSS referenced by index.html (including modulepreload); excludes dynamically imported feature code and page images',
  total: sum(entries), runtime: sum(runtime), initial: sum(initial), initialFiles: initial.map(row => row.file), files: entries };
fs.writeFileSync(path.join(output, 'metrics.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ label, buildSeconds: seconds, total: report.total, runtime: report.runtime, initial: report.initial, output: path.relative(root, output) }, null, 2));
