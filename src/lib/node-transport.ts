/**
 * Streaming Chat Completions over Node http/https.
 * Typora's renderer fetch is subject to CORS; Node's client is not.
 * macOS Typora has no Node builtins, so callers fall back to fetch.
 */

export interface NodeRequestCall {
  url: URL;
  method: string;
  headers: Record<string, string>;
  body: string;
  signal?: AbortSignal;
}

export interface NodeIncoming {
  statusCode?: number;
  headers: Record<string, string | string[] | undefined>;
  destroy(error?: Error): void;
  [Symbol.asyncIterator](): AsyncIterator<Uint8Array | Buffer>;
}

export type NodeRequestFn = (call: NodeRequestCall) => Promise<NodeIncoming>;

interface NodeClientRequest {
  write(chunk: string | Uint8Array): void;
  end(): void;
  destroy(error?: Error): void;
  on(event: 'error', listener: (error: Error) => void): void;
}

interface NodeRequestModule {
  request(options: Record<string, unknown>, callback: (res: NodeIncoming) => void): NodeClientRequest;
}

export interface FetchDeps {
  requireImpl?: (id: string) => unknown;
  fetchImpl?: typeof fetch;
  request?: NodeRequestFn;
}

export function createDefaultFetch(deps: FetchDeps = {}): typeof fetch {
  return async (input, init) => {
    const request = deps.request ?? requestFromRequire(deps.requireImpl ?? hostRequire);
    if (request) return responseFromNode(input, init, request);
    const fallback = deps.fetchImpl ?? globalThis.fetch;
    if (typeof fallback !== 'function') throw new TypeError('Failed to fetch');
    return fallback(input, init);
  };
}

function hostRequire(id: string): unknown {
  switch (id) {
    case 'http': return require('http');
    case 'https': return require('https');
    case 'url': return require('url');
    default: throw new Error('未知的运行时依赖：' + id);
  }
}

function requestFromRequire(requireImpl: (id: string) => unknown): NodeRequestFn | null {
  try {
    const http = requireImpl('http') as NodeRequestModule;
    const https = requireImpl('https') as NodeRequestModule;
    if (typeof http?.request !== 'function' || typeof https?.request !== 'function') return null;
    return (call) => nodeRequest(call.url.protocol === 'https:' ? https : http, call);
  } catch {
    return null;
  }
}

function nodeRequest(mod: NodeRequestModule, call: NodeRequestCall): Promise<NodeIncoming> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      reject(asTransportError(error, call.signal));
    };
    const headers = { ...call.headers };
    if (!headerValue(headers, 'content-length')) {
      headers['Content-Length'] = String(byteLength(call.body));
    }
    let req: NodeClientRequest;
    try {
      req = mod.request({
        protocol: call.url.protocol,
        hostname: call.url.hostname,
        port: call.url.port || undefined,
        path: `${call.url.pathname}${call.url.search}`,
        method: call.method,
        headers,
        signal: call.signal,
      }, (res) => {
        if (settled) {
          res.destroy();
          return;
        }
        settled = true;
        resolve(res);
      });
    } catch (error) {
      fail(error);
      return;
    }
    const onAbort = () => {
      req.destroy();
      fail(new DOMException('Aborted', 'AbortError'));
    };
    if (call.signal?.aborted) {
      onAbort();
      return;
    }
    call.signal?.addEventListener('abort', onAbort, { once: true });
    req.on('error', (error) => {
      call.signal?.removeEventListener('abort', onAbort);
      fail(error);
    });
    try {
      req.write(call.body);
      req.end();
    } catch (error) {
      fail(error);
    }
  });
}

async function responseFromNode(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  request: NodeRequestFn,
): Promise<Response> {
  const url = toUrl(input);
  const incoming = await request({
    url,
    method: init?.method ?? 'GET',
    headers: headersToRecord(init?.headers),
    body: bodyText(init?.body),
    signal: init?.signal ?? undefined,
  });
  const status = incoming.statusCode ?? 0;
  if (status < 200 || status > 599) {
    incoming.destroy();
    throw new TypeError('Failed to fetch');
  }
  return new Response(incomingToStream(incoming, init?.signal ?? undefined), {
    status,
    headers: headerPairs(incoming.headers),
  });
}

function incomingToStream(incoming: NodeIncoming, signal?: AbortSignal): ReadableStream<Uint8Array> {
  const iterator = incoming[Symbol.asyncIterator]();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        const next = await iterator.next();
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        if (next.done) {
          controller.close();
          return;
        }
        controller.enqueue(copyBytes(next.value));
      } catch (error) {
        controller.error(signal?.aborted || isAbortError(error)
          ? new DOMException('Aborted', 'AbortError')
          : error);
      }
    },
    cancel() {
      incoming.destroy();
      void iterator.return?.(undefined);
    },
  });
}

function copyBytes(chunk: Uint8Array | Buffer): Uint8Array {
  const view = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
  return new Uint8Array(view);
}

function toUrl(input: RequestInfo | URL): URL {
  if (typeof input === 'string') return new URL(input);
  if (input instanceof URL) return input;
  return new URL(input.url);
}

function headersToRecord(headers: HeadersInit | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) return out;
  if (typeof Headers !== 'undefined' && headers instanceof Headers) {
    headers.forEach((value, key) => { out[key] = value; });
    return out;
  }
  const pairs = Array.isArray(headers) ? headers : Object.entries(headers);
  for (const [key, value] of pairs) out[key] = value;
  return out;
}

function headerPairs(headers: NodeIncoming['headers']): [string, string][] {
  const pairs: [string, string][] = [];
  for (const [key, value] of Object.entries(headers)) {
    if (value == null) continue;
    const joined = Array.isArray(value) ? value.join(', ') : value;
    if (key.toLowerCase() === 'transfer-encoding' || key.toLowerCase() === 'content-length') continue;
    pairs.push([key, joined]);
  }
  return pairs;
}

function bodyText(body: BodyInit | null | undefined): string {
  if (typeof body === 'string') return body;
  if (body == null) return '';
  if (body instanceof Uint8Array) return new TextDecoder().decode(body);
  throw new TypeError('Failed to fetch');
}

function headerValue(headers: Record<string, string>, name: string): string | undefined {
  const found = Object.keys(headers).find(key => key.toLowerCase() === name);
  return found ? headers[found] : undefined;
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

function asTransportError(error: unknown, signal?: AbortSignal): Error {
  if (signal?.aborted || isAbortError(error)) return new DOMException('Aborted', 'AbortError');
  if (error instanceof TypeError) return error;
  return error instanceof Error ? error : new TypeError('Failed to fetch');
}

function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';
}
