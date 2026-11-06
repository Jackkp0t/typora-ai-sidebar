import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SSEParser } from '../src/lib/sse';

test('every character boundary preserves content, CRLF and DONE', () => {
  const parser = new SSEParser();
  const stream = ': heartbeat\r\nevent: message\r\ndata: {"choices":[{"delta":{"role":"assistant"}}]}\r\n\r\n'
    + 'data: {"choices":[{"delta":{"content":"你好"}}]}\r\n\r\n'
    + 'data: {"choices":[{"delta":{"content":"世界"}}]}\n\n'
    + 'data: [DONE]\n\ndata: {"choices":[{"delta":{"content":"不应出现"}}]}\n\n';
  const result: string[] = [];
  for (const character of stream) result.push(...parser.push(character));
  result.push(...parser.finish());
  assert.deepEqual(result, ['你好', '世界']);
  assert.equal(parser.done, true);
});

test('multiple data lines are joined before parsing JSON', () => {
  const parser = new SSEParser();
  assert.deepEqual(parser.push('data: {"choices":\ndata: [{"delta":{"content":"多行"}}]}\n\n'), ['多行']);
});

test('pending data is not emitted early and EOF flushes an unterminated event', () => {
  const parser = new SSEParser();
  assert.deepEqual(parser.push('data: {"choices":[{"delta":{"content":"结尾"}}]}'), []);
  assert.deepEqual(parser.finish(), ['结尾']);
  assert.deepEqual(parser.finish(), []);
});

test('empty deltas, usage and other choices do not generate text', () => {
  const parser = new SSEParser();
  assert.deepEqual(parser.push('data: {"choices":[],"usage":{}}\n\n'
    + 'data: {"choices":[{"delta":{"content":null},"finish_reason":"stop"},{"delta":{"content":"other"}}]}\n\n'), []);
});

test('malformed events and provider stream errors fail with safe Chinese errors', () => {
  assert.throws(() => new SSEParser().push('data: broken secret\n\n'), /流式响应格式/);
  assert.throws(() => new SSEParser().push('data: {"error":{"message":"secret"}}\n\n'), /服务返回/);
});

test('SSEParser records non-empty finish_reason and ignores null/empty', () => {
  const p = new SSEParser();
  p.push('data: {"choices":[{"delta":{"content":"a"},"finish_reason":null}]}\n\n');
  assert.equal(p.finishReason, null); assert.equal(p.completed, false);
  p.push('data: {"choices":[{"delta":{},"finish_reason":""}]}\n\n');
  assert.equal(p.completed, false);
  p.push('data: {"choices":[{"delta":{},"finish_reason":"length"}]}\n\n');
  assert.equal(p.finishReason, 'length'); assert.equal(p.completed, true); assert.equal(p.done, false);
});
