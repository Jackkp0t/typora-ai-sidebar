import { copyFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const outdir = 'dist/ai-doc-sidebar';
await mkdir(outdir, { recursive: true });
const require = createRequire(import.meta.url);
// Core's loader dynamically imports main.js. Its runtime lives under this Symbol,
// not in node_modules, and macOS does not supply Node's require/module.
// Capture the host require before this module's const require shadows it.
// A lexical `typeof require` here would hit the temporal dead zone of that const.
// Windows/Linux Typora exposes Node as window.require and window.reqnode; macOS has neither.
const banner = `const __nodeRequire = (function (require) {
  return typeof require === 'function' ? require : null;
})((function () {
  try {
    if (typeof globalThis.require === 'function') return globalThis.require;
    if (typeof globalThis.reqnode === 'function') return globalThis.reqnode;
    if (typeof process !== 'undefined' && process.mainModule && typeof process.mainModule.require === 'function') {
      return process.mainModule.require.bind(process.mainModule);
    }
  } catch (error) {}
  return null;
})());
const module = { exports: {} };
const require = (id) => {
  if (id === '@typora-community-plugin/core') {
    const core = globalThis[Symbol.for('typora-plugin-core@v2')];
    if (!core) throw new Error('请先安装并启用 Typora Community Plugin Core 2.10.x');
    return core;
  }
  if (id === 'http' || id === 'https' || id === 'url' || id === 'node:http' || id === 'node:https' || id === 'node:url') {
    if (typeof __nodeRequire !== 'function') throw new Error('当前环境没有 Node 内置模块：' + id);
    const name = id.startsWith('node:') ? id.slice(5) : id;
    return __nodeRequire(name);
  }
  throw new Error('未知的运行时依赖：' + id);
};
/* ai-doc-sidebar-require-shim */`;
const result = spawnSync(require.resolve('esbuild/bin/esbuild'), [
  'src/main.ts', `--outfile=${outdir}/main.js`, '--bundle', '--format=cjs',
  '--platform=browser', '--target=es2020', '--external:@typora-community-plugin/core',
  '--external:http', '--external:https', '--external:url',
  '--external:node:http', '--external:node:https', '--external:node:url',
  `--banner:js=${banner}`, '--footer:js=export default module.exports.default;',
], { stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
for (const file of ['manifest.json', 'style.css']) {
  await copyFile(file, `${outdir}/${file}`);
}
