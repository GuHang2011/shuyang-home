// Check the emitted module graph, including lazy features absent from the first screen.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { init, parse } = require('../frontend/mobile/node_modules/es-module-lexer');
const root = path.resolve(__dirname, '../frontend/mobile/dist/build/h5');
async function run() {
  assert(fs.existsSync(path.join(root, 'index.html')), 'Build mobile H5 before checking its imports');
  await init;
  const files = [], failures = []; let imports = 0, dynamic = 0;
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(file); else if (entry.name.endsWith('.js')) files.push(file);
    }
  }
  walk(root);
  for (const file of files) {
    const [entries] = parse(fs.readFileSync(file, 'utf8'));
    for (const entry of entries) {
      if (entry.d === -2) continue; // import.meta
      imports++; if (entry.d >= 0) dynamic++;
      const label = path.relative(root, file).replaceAll('\\', '/') + ': ' + String(entry.n);
      if (typeof entry.n !== 'string' || !/^\.\.?\//.test(entry.n)) {
        failures.push(label + ' is not an explicit relative module path'); continue;
      }
      const target = path.resolve(path.dirname(file), entry.n);
      if (!target.startsWith(root + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) failures.push(label + ' has no emitted local target');
    }
  }
  assert(imports > 0 && dynamic > 0, 'Expected both a module graph and lazy feature imports');
  assert.deepEqual(failures, [], 'All H5 imports must resolve in the emitted bundle at any deployment subpath');
  console.log(`PASS: ${imports} imports (${dynamic} dynamic) across ${files.length} H5 JavaScript files resolve to emitted relative targets`);
}
run().catch(error => { console.error(error); process.exitCode = 1; });
