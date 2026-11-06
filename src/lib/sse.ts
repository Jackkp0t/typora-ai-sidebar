import { ChatError } from './errors';

/** Incremental SSE framing, independent of byte chunking (decode UTF-8 first). */
export class SSEParser {
  done = false;
  /** Last non-empty choices[0].finish_reason seen in the stream, if any. */
  finishReason: string | null = null;
  /** True once [DONE] arrived or a non-empty finish_reason was reported. */
  get completed(): boolean { return this.done || this.finishReason !== null; }
  private line = '';
  private data: string[] = [];
  private afterCR = false;

  push(chunk: string): string[] {
    const output: string[] = [];
    for (const char of chunk) {
      if (this.done) break;
      if (this.afterCR) {
        this.afterCR = false;
        if (char === '\n') continue;
      }
      if (char === '\r' || char === '\n') {
        this.consumeLine(output);
        this.afterCR = char === '\r';
      } else {
        this.line += char;
      }
    }
    return output;
  }

  finish(): string[] {
    const output: string[] = [];
    if (!this.done) {
      if (this.line) this.consumeLine(output);
      this.dispatch(output);
    }
    return output;
  }

  private consumeLine(output: string[]): void {
    const line = this.line;
    this.line = '';
    if (!line) { this.dispatch(output); return; }
    const colon = line.indexOf(':');
    const field = colon < 0 ? line : line.slice(0, colon);
    if (field !== 'data') return;
    let value = colon < 0 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    this.data.push(value);
  }

  private dispatch(output: string[]): void {
    const data = this.data.join('\n');
    this.data = [];
    if (!data.trim()) return;
    if (data.trim() === '[DONE]') { this.done = true; return; }
    let event: unknown;
    try { event = JSON.parse(data); }
    catch { throw new ChatError('流式响应格式无效，请检查服务是否兼容 OpenAI Chat Completions。'); }
    if (typeof event !== 'object' || event === null) {
      throw new ChatError('流式响应格式无效，请检查接口地址。');
    }
    const message = event as { error?: unknown; choices?: { delta?: { content?: unknown }; finish_reason?: unknown }[] };
    if (message.error) throw new ChatError('服务返回流式错误，请检查配置或稍后重试。');
    if (message.choices !== undefined && !Array.isArray(message.choices)) {
      throw new ChatError('流式响应格式无效，请检查接口地址。');
    }
    const finish = message.choices?.[0]?.finish_reason;
    if (typeof finish === 'string' && finish) this.finishReason = finish;
    const content = message.choices?.[0]?.delta?.content;
    if (typeof content === 'string' && content) output.push(content);
  }
}
