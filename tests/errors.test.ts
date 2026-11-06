import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HttpError, toChineseError } from '../src/lib/errors';

for (const [status, pattern] of [
  [401, /API Key.*无效/], [403, /权限/], [404, /地址或模型/],
  [429, /频繁|额度/], [500, /服务.*异常/], [503, /服务.*异常/], [400, /400/],
] as const) {
  test(`HTTP ${status} maps to a Chinese action`, () => {
    assert.match(toChineseError(new HttpError(status)), pattern);
  });
}
test('network, timeout and unknown errors do not expose raw provider text', () => {
  assert.match(toChineseError(new TypeError('Failed to fetch')), /网络.*跨域/);
  assert.match(toChineseError(new DOMException('aborted', 'AbortError')), /超时/);
  assert.match(toChineseError(new DOMException('timeout', 'TimeoutError')), /超时/);
  assert.equal(toChineseError(new Error('secret-key')), '请求失败，请检查配置后重试。');
  assert.equal(toChineseError(null), '请求失败，请检查配置后重试。');
});
