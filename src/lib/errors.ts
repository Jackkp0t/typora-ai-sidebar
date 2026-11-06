/** Safe, user-facing error. Never pass provider bodies or credentials here. */
export class ChatError extends Error {}

export class HttpError extends Error {
  constructor(readonly status: number) { super(`HTTP ${status}`); }
}

export function toChineseError(error: unknown): string {
  if (error instanceof HttpError) {
    switch (error.status) {
      case 401: return 'API Key 无效或已过期，请在设置中检查。';
      case 403: return '没有访问权限，请检查 API Key 的权限及服务地区限制。';
      case 404: return '接口地址或模型不存在，请检查 Base URL 和模型名称。';
      case 429: return '请求过于频繁或额度不足，请稍后重试并检查账户额度。';
      default: return error.status >= 500 && error.status <= 599
        ? '服务端暂时异常，请稍后重试。'
        : `请求失败（HTTP ${error.status}），请检查配置后重试。`;
    }
  }
  if (error instanceof ChatError) return error.message;
  if (typeof error === 'object' && error !== null && 'name' in error
    && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
    return '请求超时，请检查网络或在设置中增加超时时间。';
  }
  if (error instanceof TypeError) return '网络连接失败，请检查网络、接口地址及服务端跨域（CORS）配置。';
  return '请求失败，请检查配置后重试。';
}
