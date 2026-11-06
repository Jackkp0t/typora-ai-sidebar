import { ChatError, HttpError } from './errors';
import { createDefaultFetch } from './node-transport';
import { SSEParser } from './sse';

export interface ChatSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  timeoutSec: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatOptions extends ChatSettings {
  history: readonly ChatMessage[];
  onDelta: (content: string) => void;
  signal?: AbortSignal;
}

/** No DOM/editor access: the caller explicitly supplies the session history. */
export async function streamChat(options: ChatOptions, fetchImpl: typeof fetch = createDefaultFetch()): Promise<string> {
  if (!options.apiKey.trim()) throw new ChatError('请先在插件设置中配置 API Key。');
  const baseUrl = options.baseUrl.trim().replace(/\/+$/, '');
  let url: URL;
  try { url = new URL(`${baseUrl}/chat/completions`); }
  catch { throw new ChatError('接口地址无效，请在设置中填写完整的 Base URL。'); }
  if (!['https:', 'http:'].includes(url.protocol)) throw new ChatError('接口地址必须使用 HTTP 或 HTTPS。');
  if (!options.model.trim()) throw new ChatError('请先在插件设置中填写模型名称。');

  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) abort();
  const timeoutSec = Number.isFinite(options.timeoutSec) && options.timeoutSec > 0
    ? Math.min(options.timeoutSec, 3600) : 60;
  const timer = setTimeout(abort, timeoutSec * 1000);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const checkAbort = () => {
    if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
  };
  const cancelReader = () => { void reader?.cancel().catch(() => {}); };
  controller.signal.addEventListener('abort', cancelReader, { once: true });

  try {
    checkAbort();
    const response = await fetchImpl(url.href, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${options.apiKey.trim()}` },
      body: JSON.stringify({
        model: options.model.trim(), stream: true,
        messages: [{ role: 'system', content: options.systemPrompt },
          ...options.history.map(({ role, content }) => ({ role, content }))],
      }),
      signal: controller.signal,
    });
    checkAbort();
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      throw new HttpError(response.status);
    }
    if (!response.body) throw new ChatError('服务未返回流式内容，请检查接口配置。');
    reader = response.body.getReader();
    const decoder = new TextDecoder();
    const parser = new SSEParser();
    let text = '';
    const emit = (parts: string[]) => {
      for (const part of parts) { text += part; options.onDelta(part); }
    };
    while (!parser.done) {
      checkAbort();
      const { done, value } = await reader.read();
      checkAbort();
      if (done) {
        emit(parser.push(decoder.decode()));
        emit(parser.finish());
        if (!parser.completed) throw new ChatError('响应流意外中断，请重试。');
        break;
      }
      emit(parser.push(decoder.decode(value, { stream: true })));
    }
    return text;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
    controller.signal.removeEventListener('abort', cancelReader);
    if (reader) {
      try { await reader.cancel(); } catch { /* transport already failed */ }
      reader.releaseLock();
    }
  }
}
