import { copyFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const outdir = 'dist/ai-doc-sidebar';
await mkdir(outdir, { recursive: true });
const require = createRequire(import.meta.url);
// Core's loader dynamically imports main.js. Its runtime lives under this Symbol,
// not in node_modules, and macOS does not supply Node's require/module.
const banner = `const module = { exports: {} };
const require = (id) => {
  if (id === '@typora-community-plugin/core') {
    const core = globalThis[Symbol.for('typora-plugin-core@v2')];
    if (!core) throw new Error('请先安装并启用 Typora Community Plugin Core 2.10.x');
    return core;
  }
  throw new Error('未知的运行时依赖：' + id);
};`;
const result = spawnSync(require.resolve('esbuild/bin/esbuild'), [
  'src/main.ts', `--outfile=${outdir}/main.js`, '--bundle', '--format=cjs',
  '--platform=browser', '--target=es2020', '--external:@typora-community-plugin/core',
  `--banner:js=${banner}`, '--footer:js=export default module.exports.default;',
], { stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
for (const file of ['manifest.json', 'style.css']) {
  await copyFile(file, `${outdir}/${file}`);
}
