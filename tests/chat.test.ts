import { test } from 'node:test';
import assert from 'node:assert/strict';
import { streamChat } from '../src/lib/chat';
import { toChineseError } from '../src/lib/errors';

const settings = {
  baseUrl: 'https://example.test/v1///', apiKey: 'test-only-key', model: 'test-model',
  systemPrompt: '中文系统提示', timeoutSec: 60,
};

test('request contains only configured prompt and explicit session history; split UTF-8 streams', async () => {
  const deltas: string[] = [];
  let request: { url?: string; init?: RequestInit } = {};
  const result = await streamChat({ ...settings,
    history: [
      { role: 'user', content: '上一轮问题' }, { role: 'assistant', content: '上一轮回答' },
      { role: 'user', content: '用户明确发送' },
    ], onDelta: part => deltas.push(part),
  }, async (url, init) => {
    request = { url: String(url), init };
    const bytes = new TextEncoder().encode('data: {"choices":[{"delta":{"content":"中文"}}]}\n\ndata: [DONE]\n\n');
    return new Response(new ReadableStream({ start(controller) {
      for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
      controller.close();
    } }), { headers: { 'Content-Type': 'text/event-stream' } });
  });
  assert.equal(result, '中文');
  assert.deepEqual(deltas, ['中文']);
  assert.equal(request.url, 'https://example.test/v1/chat/completions');
  assert.deepEqual(JSON.parse(String(request.init?.body)), {
    model: 'test-model', stream: true, messages: [
      { role: 'system', content: '中文系统提示' },
      { role: 'user', content: '上一轮问题' },
      { role: 'assistant', content: '上一轮回答' },
      { role: 'user', content: '用户明确发送' },
    ],
  });
  assert.equal((request.init?.headers as Record<string, string>).Authorization, 'Bearer test-only-key');
  assert.ok(request.init?.signal instanceof AbortSignal);
});

test('blank API key blocks all requests', async () => {
  let calls = 0;
  await assert.rejects(streamChat({ ...settings, apiKey: '  ', history: [], onDelta() {} }, async () => {
    calls++; return new Response();
  }), /设置.*API Key/);
  assert.equal(calls, 0);
});

test('HTTP failure is mapped without reading provider secrets', async () => {
  await assert.rejects(streamChat({ ...settings, history: [], onDelta() {} }, async () =>
    new Response('secret provider response', { status: 401 })), error => {
    assert.match(toChineseError(error), /API Key.*无效/);
    return true;
  });
});

test('AbortController timeout covers response headers', async () => {
  await assert.rejects(streamChat({ ...settings, timeoutSec: 0.01, history: [], onDelta() {} },
    async (_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
    })), error => { assert.match(toChineseError(error), /超时/); return true; });
});

test('timeout also cancels a stalled body and unlocks its reader', async () => {
  let canceled = false;
  const body = new ReadableStream<Uint8Array>({ cancel() { canceled = true; } });
  await assert.rejects(streamChat({ ...settings, timeoutSec: 0.01, history: [], onDelta() {} },
    async () => new Response(body)), error => {
    assert.match(toChineseError(error), /超时/); return true;
  });
  assert.equal(canceled, true);
  assert.equal(body.locked, false);
});

test('DONE cancels a still-open transport rather than waiting for EOF', async () => {
  let canceled = false;
  const body = new ReadableStream<Uint8Array>({ start(controller) {
    controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
  }, cancel() { canceled = true; } });
  assert.equal(await streamChat({ ...settings, history: [], onDelta() {} }, async () => new Response(body)), '');
  assert.equal(canceled, true);
  assert.equal(body.locked, false);
});

test('truncated stream is a visible error, not a successful assistant turn', async () => {
  await assert.rejects(streamChat({ ...settings, history: [], onDelta() {} },
    async () => new Response('data: {"choices":[{"delta":{"content":"不完整"}}]}\n\n')), /中断/);
});

test('external cancellation prevents a new request', async () => {
  const controller = new AbortController(); controller.abort();
  let calls = 0;
  await assert.rejects(streamChat({ ...settings, history: [], onDelta() {}, signal: controller.signal }, async () => {
    calls++; return new Response();
  }));
  assert.equal(calls, 0);
});

const streamOf = (body: string) => async () => new Response(new ReadableStream({ start(c) {
  c.enqueue(new TextEncoder().encode(body)); c.close();
} }), { headers: { 'Content-Type': 'text/event-stream' } });

test('stream without [DONE] but with finish_reason "stop" succeeds', async () => {
  const result = await streamChat({ ...settings, history: [{ role: 'user', content: 'q' }], onDelta: () => {} },
    streamOf('data: {"choices":[{"delta":{"content":"完整"},"finish_reason":null}]}\n\ndata: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n'));
  assert.equal(result, '完整');
});

test('stream without [DONE] and without finish_reason is still a truncation error', async () => {
  await assert.rejects(streamChat({ ...settings, history: [{ role: 'user', content: 'q' }], onDelta: () => {} },
    streamOf('data: {"choices":[{"delta":{"content":"半"},"finish_reason":null}]}\n\n')), /响应流意外中断/);
});
