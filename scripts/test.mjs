import { createRequire } from 'node:module';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const outdir = await mkdtemp(join(tmpdir(), 'ai-doc-sidebar-tests-'));
try {
  const files = (await readdir('tests')).filter(name => name.endsWith('.test.ts'));
  const require = createRequire(import.meta.url);
  const compiled = spawnSync(require.resolve('esbuild/bin/esbuild'), [
    ...files.map(name => `tests/${name}`), `--outdir=${outdir}`, '--bundle',
    '--platform=node', '--format=cjs', '--target=node18', '--out-extension:.js=.cjs',
  ], { stdio: 'inherit' });
  if (compiled.error) throw compiled.error;
  if (compiled.status !== 0) throw new Error('测试编译失败');
  // Node 22.7+ 暴露隔离开关的名字不一致：较新构建使用 --test-isolation，
  // 部分 22.x 构建只接受 --experimental-test-isolation。探测后再跑，避免测试无法启动。
  const isolationFlag = ['--test-isolation=none', '--experimental-test-isolation=none'].find((flag) => {
    const probe = spawnSync(process.execPath, [flag, '-e', 'process.exit(0)'], { stdio: 'ignore' });
    return probe.status === 0;
  });
  const result = spawnSync(process.execPath, [
    '--test',
    ...(isolationFlag ? [isolationFlag] : []),
    ...files.map(name => join(outdir, name.replace(/\.ts$/, '.cjs'))),
  ], { stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  await rm(outdir, { recursive: true, force: true });
}
