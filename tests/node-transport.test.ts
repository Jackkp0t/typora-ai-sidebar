import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { streamChat } from '../src/lib/chat';
import { toChineseError } from '../src/lib/errors';
import { createDefaultFetch, type NodeRequestFn } from '../src/lib/node-transport';

const settings = {
  apiKey: 'test-only-key', model: 'test-model', systemPrompt: '中文系统提示', timeoutSec: 5,
};

async function withServer(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  try {
    const { port } = server.address() as AddressInfo;
    await run(`http://127.0.0.1:${port}/v1`);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  }
}

async function withoutBrowserFetch<T>(run: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => { throw new TypeError('Failed to fetch'); }) as typeof fetch;
  try { return await run(); }
  finally { globalThis.fetch = original; }
}

test('node transport streams a chat completion without browser fetch or CORS', async () => {
  let authorization = '';
  let body: { stream?: boolean; model?: string; messages?: { role: string; content: string }[] } = {};
  await withServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      authorization = String(req.headers.authorization);
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      assert.equal(req.url, '/v1/chat/completions');
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.end('data: {"choices":[{"delta":{"content":"中文"}}]}\n\ndata: [DONE]\n\n');
    });
  }, async (baseUrl) => {
    const deltas: string[] = [];
    const text = await withoutBrowserFetch(() => streamChat({
      ...settings, baseUrl, history: [{ role: 'user', content: '用户明确发送' }],
      onDelta: (part) => deltas.push(part),
    }));
    assert.equal(text, '中文');
    assert.deepEqual(deltas, ['中文']);
    assert.equal(authorization, 'Bearer test-only-key');
    assert.equal(body.stream, true);
    assert.equal(body.model, 'test-model');
    assert.deepEqual(body.messages?.[0], { role: 'system', content: '中文系统提示' });
    assert.deepEqual(body.messages?.at(-1), { role: 'user', content: '用户明确发送' });
  });
});

test('node transport timeout aborts a request that never returns headers', async () => {
  await withServer(() => { /* headers never arrive */ }, async (baseUrl) => {
    await withoutBrowserFetch(() => assert.rejects(streamChat({
      ...settings, baseUrl, timeoutSec: 0.05, history: [], onDelta() {},
    }), (error) => {
      assert.match(toChineseError(error), /超时/);
      return true;
    }));
  });
});

test('node transport timeout cancels a stalled response body', async () => {
  let release = () => {};
  const closed = new Promise<void>((resolve) => { release = resolve; });
  await withServer((req, res) => {
    req.on('aborted', release);
    res.socket?.on('close', release);
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.write('data: {"choices":[{"delta":{"content":"半"}}]}\n\n');
  }, async (baseUrl) => {
    await withoutBrowserFetch(() => assert.rejects(streamChat({
      ...settings, baseUrl, timeoutSec: 0.05, history: [{ role: 'user', content: 'q' }], onDelta() {},
    }), (error) => {
      assert.match(toChineseError(error), /超时/);
      return true;
    }));
    await Promise.race([
      closed,
      new Promise((_, reject) => setTimeout(() => reject(new Error('超时后连接未关闭')), 200)),
    ]);
  });
});

test('node transport HTTP failure stays a status error and hides the provider body', async () => {
  await withServer((_req, res) => {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end('{"error":"sk-secret-should-not-leak"}');
  }, async (baseUrl) => {
    await withoutBrowserFetch(() => assert.rejects(streamChat({
      ...settings, baseUrl, history: [], onDelta() {},
    }), (error) => {
      const message = toChineseError(error);
      assert.match(message, /API Key.*无效/);
      assert.equal(message.includes('sk-secret'), false);
      return true;
    }));
  });
});

test('injectable node request streams https bytes one at a time without fetch', async () => {
  const payload = new TextEncoder().encode('data: {"choices":[{"delta":{"content":"不经CORS"}}]}\n\ndata: [DONE]\n\n');
  let seen: { protocol?: string; path?: string; authorization?: string; stream?: boolean } = {};
  const request: NodeRequestFn = async (call) => {
    seen = {
      protocol: call.url.protocol,
      path: call.url.pathname,
      authorization: call.headers.Authorization,
      stream: JSON.parse(call.body).stream,
    };
    let index = 0;
    return {
      statusCode: 200,
      headers: { 'content-type': 'text/event-stream' },
      destroy() {},
      async *[Symbol.asyncIterator]() {
        while (index < payload.length) yield payload.subarray(index, ++index);
      },
    };
  };
  let fetchCalled = false;
  const fetchImpl = createDefaultFetch({
    request,
    requireImpl() { throw new Error('injected request must not load Node builtins'); },
    fetchImpl: async () => { fetchCalled = true; throw new TypeError('Failed to fetch'); },
  });
  const text = await streamChat({
    ...settings, baseUrl: 'https://bmc-llm-relay.bluemediagroup.cn/v1',
    history: [{ role: 'user', content: '解读' }], onDelta() {},
  }, fetchImpl);
  assert.equal(text, '不经CORS');
  assert.equal(fetchCalled, false);
  assert.equal(seen.protocol, 'https:');
  assert.equal(seen.path, '/v1/chat/completions');
  assert.equal(seen.authorization, 'Bearer test-only-key');
  assert.equal(seen.stream, true);
});

test('browser fetch is used only when Node http and https cannot be loaded', async () => {
  let requested = '';
  const fetchImpl = createDefaultFetch({
    requireImpl() { throw new Error('当前环境没有 Node'); },
    fetchImpl: async (input) => {
      requested = String(input);
      return new Response('data: {"choices":[{"delta":{"content":"浏览器"},"finish_reason":"stop"}]}\n\n');
    },
  });
  const text = await streamChat({
    ...settings, baseUrl: 'https://example.test/v1/',
    history: [{ role: 'user', content: 'q' }], onDelta() {},
  }, fetchImpl);
  assert.equal(text, '浏览器');
  assert.equal(requested, 'https://example.test/v1/chat/completions');
});

test('built require shim forwards http, https and url, and still loads core without Node', async () => {
  const code = await readFile('dist/ai-doc-sidebar/main.js', 'utf8');
  const marker = '/* ai-doc-sidebar-require-shim */';
  const end = code.indexOf(marker);
  assert.ok(end > 0, 'banner marker missing');
  const banner = code.slice(0, end + marker.length);

  const run = (sandbox: Record<string, unknown>) => {
    const context = vm.createContext(sandbox);
    vm.runInContext(`${banner}\nglobalThis.__shim = require;\n`, context);
    return (sandbox as { __shim: (id: string) => unknown }).__shim;
  };

  const loaded: string[] = [];
  const host = (id: string) => { loaded.push(id); return { id }; };
  const shim = run({ require: host, Symbol, process: {} });
  assert.deepEqual(shim('https'), { id: 'https' });
  assert.deepEqual(shim('http'), { id: 'http' });
  assert.deepEqual(shim('url'), { id: 'url' });
  assert.deepEqual(shim('node:https'), { id: 'https' });
  assert.throws(() => shim('fs'), /未知的运行时依赖/);
  assert.deepEqual(loaded, ['https', 'http', 'url', 'https']);

  const viaMain = run({
    Symbol,
    process: { mainModule: { require: host } },
  });
  assert.deepEqual(viaMain('http'), { id: 'http' });

  const viaReqnode = run({ Symbol, reqnode: host, process: {} });
  assert.deepEqual(viaReqnode('https'), { id: 'https' });

  const core = { Plugin: class {} };
  const bare = run({
    Symbol,
    process: {},
    [Symbol.for('typora-plugin-core@v2')]: core,
  });
  assert.equal(bare('@typora-community-plugin/core'), core);
  assert.throws(() => bare('https'), /Node/);
  assert.match(code, /require\(["']https["']\)/);
  assert.match(code, /require\(["']http["']\)/);
});
