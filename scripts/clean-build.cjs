// Clean only generated output. Some Windows Node runtimes leave entries behind with rmSync.
const fs = require('node:fs'), path = require('node:path');
const targets = { web: 'frontend/dist', demo: 'frontend/dist-demo', h5: 'frontend/mobile/dist/build/h5', 'mp-weixin': 'frontend/mobile/dist/build/mp-weixin' };
const target = process.argv[2];
if (!Object.hasOwn(targets, target)) throw Error('Expected web, demo, h5 or mp-weixin');
const root = fs.realpathSync(path.resolve(__dirname, '..'));
const folder = path.join(root, targets[target]);
function remove(directory) {
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    // Unlink symlinks as entries; never traverse their targets.
    if (item.isDirectory() && !item.isSymbolicLink()) remove(file);
    else fs.unlinkSync(file);
  }
  fs.rmdirSync(directory);
}
if (fs.existsSync(folder)) {
  const resolved = fs.realpathSync(folder);
  if (resolved !== folder) throw Error('Refusing to clean a redirected build directory: ' + folder);
  console.log('Cleaning generated build:', resolved);
  remove(resolved);
}
