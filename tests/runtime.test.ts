import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('built entry loads as ESM using only the core Symbol, without Node require or module globals', async () => {
  const code = await readFile('dist/ai-doc-sidebar/main.js', 'utf8');
  const key = Symbol.for('typora-plugin-core@v2');
  const globals = globalThis as unknown as Record<symbol, unknown>;
  const previous = globals[key];
  class RuntimePlugin {}
  globals[key] = {
    Plugin: RuntimePlugin,
    PluginSettings: class {},
    SidebarPanel: class {},
    SettingTab: class {},
  };
  try {
    // Native import is intentional: this is the protocol used by core's loader.
    const nativeImport = new Function('url', 'return import(url)') as (url: string) => Promise<{ default: unknown }>;
    const loaded = await nativeImport(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
    assert.equal(typeof loaded.default, 'function');
    assert.ok((loaded.default as { prototype: object }).prototype instanceof RuntimePlugin);
  } finally {
    if (previous === undefined) delete globals[key];
    else globals[key] = previous;
  }
});
