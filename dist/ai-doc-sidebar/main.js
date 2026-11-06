const __nodeRequire = (function (require) {
  return typeof require === 'function' ? require : null;
})((function () {
  try {
    if (typeof globalThis.require === 'function') return globalThis.require;
    if (typeof globalThis.reqnode === 'function') return globalThis.reqnode;
    if (typeof process !== 'undefined' && process.mainModule && typeof process.mainModule.require === 'function') {
      return process.mainModule.require.bind(process.mainModule);
    }
  } catch (error) {}
  return null;
})());
const module = { exports: {} };
const require = (id) => {
  if (id === '@typora-community-plugin/core') {
    const core = globalThis[Symbol.for('typora-plugin-core@v2')];
    if (!core) throw new Error('请先安装并启用 Typora Community Plugin Core 2.10.x');
    return core;
  }
  if (id === 'http' || id === 'https' || id === 'url' || id === 'node:http' || id === 'node:https' || id === 'node:url') {
    if (typeof __nodeRequire !== 'function') throw new Error('当前环境没有 Node 内置模块：' + id);
    const name = id.startsWith('node:') ? id.slice(5) : id;
    return __nodeRequire(name);
  }
  throw new Error('未知的运行时依赖：' + id);
};
/* ai-doc-sidebar-require-shim */
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => AiDocSidebarPlugin
});
module.exports = __toCommonJS(main_exports);
var import_core3 = require("@typora-community-plugin/core");

// src/lib/selection.ts
function readCM(cm) {
  try {
    const c = cm;
    if (!c || typeof c.getSelection !== "function") return "";
    if (typeof c.somethingSelected === "function" && !c.somethingSelected()) return "";
    const text = c.getSelection();
    return typeof text === "string" ? text : "";
  } catch {
    return "";
  }
}
function getSelectedText(win = globalThis, doc = globalThis.document) {
  try {
    const text = win.getSelection?.()?.toString() ?? "";
    if (text.trim()) return text;
  } catch {
  }
  const candidates = [];
  try {
    const sv = win.File?.editor?.sourceView;
    if (sv?.cm) candidates.push(sv.cm);
  } catch {
  }
  try {
    const active = doc?.activeElement?.closest?.(".CodeMirror");
    if (active) candidates.push(active.CodeMirror);
    const focused = doc?.querySelector?.(".CodeMirror-focused");
    if (focused) candidates.push(focused.CodeMirror);
    const all = doc?.querySelectorAll?.(".CodeMirror") ?? [];
    for (const el of Array.from(all)) candidates.push(el.CodeMirror);
  } catch {
  }
  for (const cm of candidates) {
    const text = readCM(cm);
    if (text.trim()) return text;
  }
  return "";
}

// src/panel.ts
var import_core2 = require("@typora-community-plugin/core");

// src/lib/errors.ts
var ChatError = class extends Error {
};
var HttpError = class extends Error {
  constructor(status) {
    super(`HTTP ${status}`);
    this.status = status;
  }
};
function toChineseError(error) {
  if (error instanceof HttpError) {
    switch (error.status) {
      case 401:
        return "API Key \u65E0\u6548\u6216\u5DF2\u8FC7\u671F\uFF0C\u8BF7\u5728\u8BBE\u7F6E\u4E2D\u68C0\u67E5\u3002";
      case 403:
        return "\u6CA1\u6709\u8BBF\u95EE\u6743\u9650\uFF0C\u8BF7\u68C0\u67E5 API Key \u7684\u6743\u9650\u53CA\u670D\u52A1\u5730\u533A\u9650\u5236\u3002";
      case 404:
        return "\u63A5\u53E3\u5730\u5740\u6216\u6A21\u578B\u4E0D\u5B58\u5728\uFF0C\u8BF7\u68C0\u67E5 Base URL \u548C\u6A21\u578B\u540D\u79F0\u3002";
      case 429:
        return "\u8BF7\u6C42\u8FC7\u4E8E\u9891\u7E41\u6216\u989D\u5EA6\u4E0D\u8DB3\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u5E76\u68C0\u67E5\u8D26\u6237\u989D\u5EA6\u3002";
      default:
        return error.status >= 500 && error.status <= 599 ? "\u670D\u52A1\u7AEF\u6682\u65F6\u5F02\u5E38\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002" : `\u8BF7\u6C42\u5931\u8D25\uFF08HTTP ${error.status}\uFF09\uFF0C\u8BF7\u68C0\u67E5\u914D\u7F6E\u540E\u91CD\u8BD5\u3002`;
    }
  }
  if (error instanceof ChatError) return error.message;
  if (typeof error === "object" && error !== null && "name" in error && (error.name === "AbortError" || error.name === "TimeoutError")) {
    return "\u8BF7\u6C42\u8D85\u65F6\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u6216\u5728\u8BBE\u7F6E\u4E2D\u589E\u52A0\u8D85\u65F6\u65F6\u95F4\u3002";
  }
  if (error instanceof TypeError) {
    return "\u7F51\u7EDC\u8FDE\u63A5\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u3001\u63A5\u53E3\u5730\u5740\u53CA\u670D\u52A1\u7AEF\u8DE8\u57DF\uFF08CORS\uFF09\u914D\u7F6E\u3002\u82E5\u5728 macOS \u4E0A\uFF0CTypora \u53EF\u80FD\u6CA1\u6709 Node\uFF0C\u6D4F\u89C8\u5668 fetch \u4ECD\u53D7\u8DE8\u57DF\uFF08CORS\uFF09\u9650\u5236\u3002";
  }
  return "\u8BF7\u6C42\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u914D\u7F6E\u540E\u91CD\u8BD5\u3002";
}

// src/lib/node-transport.ts
function createDefaultFetch(deps = {}) {
  return async (input, init) => {
    const request = deps.request ?? requestFromRequire(deps.requireImpl ?? hostRequire);
    if (request) return responseFromNode(input, init, request);
    const fallback = deps.fetchImpl ?? globalThis.fetch;
    if (typeof fallback !== "function") throw new TypeError("Failed to fetch");
    return fallback(input, init);
  };
}
function hostRequire(id) {
  switch (id) {
    case "http":
      return require("http");
    case "https":
      return require("https");
    case "url":
      return require("url");
    default:
      throw new Error("\u672A\u77E5\u7684\u8FD0\u884C\u65F6\u4F9D\u8D56\uFF1A" + id);
  }
}
function requestFromRequire(requireImpl) {
  try {
    const http = requireImpl("http");
    const https = requireImpl("https");
    if (typeof http?.request !== "function" || typeof https?.request !== "function") return null;
    return (call) => nodeRequest(call.url.protocol === "https:" ? https : http, call);
  } catch {
    return null;
  }
}
function nodeRequest(mod, call) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(asTransportError(error, call.signal));
    };
    const headers = { ...call.headers };
    if (!headerValue(headers, "content-length")) {
      headers["Content-Length"] = String(byteLength(call.body));
    }
    let req;
    try {
      req = mod.request({
        protocol: call.url.protocol,
        hostname: call.url.hostname,
        port: call.url.port || void 0,
        path: `${call.url.pathname}${call.url.search}`,
        method: call.method,
        headers,
        signal: call.signal
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
      fail(new DOMException("Aborted", "AbortError"));
    };
    if (call.signal?.aborted) {
      onAbort();
      return;
    }
    call.signal?.addEventListener("abort", onAbort, { once: true });
    req.on("error", (error) => {
      call.signal?.removeEventListener("abort", onAbort);
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
async function responseFromNode(input, init, request) {
  const url = toUrl(input);
  const incoming = await request({
    url,
    method: init?.method ?? "GET",
    headers: headersToRecord(init?.headers),
    body: bodyText(init?.body),
    signal: init?.signal ?? void 0
  });
  const status = incoming.statusCode ?? 0;
  if (status < 200 || status > 599) {
    incoming.destroy();
    throw new TypeError("Failed to fetch");
  }
  return new Response(incomingToStream(incoming, init?.signal ?? void 0), {
    status,
    headers: headerPairs(incoming.headers)
  });
}
function incomingToStream(incoming, signal) {
  const iterator = incoming[Symbol.asyncIterator]();
  return new ReadableStream({
    async pull(controller) {
      try {
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
        const next = await iterator.next();
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
        if (next.done) {
          controller.close();
          return;
        }
        controller.enqueue(copyBytes(next.value));
      } catch (error) {
        controller.error(signal?.aborted || isAbortError(error) ? new DOMException("Aborted", "AbortError") : error);
      }
    },
    cancel() {
      incoming.destroy();
      void iterator.return?.(void 0);
    }
  });
}
function copyBytes(chunk) {
  const view = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
  return new Uint8Array(view);
}
function toUrl(input) {
  if (typeof input === "string") return new URL(input);
  if (input instanceof URL) return input;
  return new URL(input.url);
}
function headersToRecord(headers) {
  const out = {};
  if (!headers) return out;
  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    headers.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  const pairs = Array.isArray(headers) ? headers : Object.entries(headers);
  for (const [key, value] of pairs) out[key] = value;
  return out;
}
function headerPairs(headers) {
  const pairs = [];
  for (const [key, value] of Object.entries(headers)) {
    if (value == null) continue;
    const joined = Array.isArray(value) ? value.join(", ") : value;
    if (key.toLowerCase() === "transfer-encoding" || key.toLowerCase() === "content-length") continue;
    pairs.push([key, joined]);
  }
  return pairs;
}
function bodyText(body) {
  if (typeof body === "string") return body;
  if (body == null) return "";
  if (body instanceof Uint8Array) return new TextDecoder().decode(body);
  throw new TypeError("Failed to fetch");
}
function headerValue(headers, name) {
  const found = Object.keys(headers).find((key) => key.toLowerCase() === name);
  return found ? headers[found] : void 0;
}
function byteLength(text) {
  return new TextEncoder().encode(text).byteLength;
}
function asTransportError(error, signal) {
  if (signal?.aborted || isAbortError(error)) return new DOMException("Aborted", "AbortError");
  if (error instanceof TypeError) return error;
  return error instanceof Error ? error : new TypeError("Failed to fetch");
}
function isAbortError(error) {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}

// src/lib/sse.ts
var SSEParser = class {
  constructor() {
    this.done = false;
    /** Last non-empty choices[0].finish_reason seen in the stream, if any. */
    this.finishReason = null;
    this.line = "";
    this.data = [];
    this.afterCR = false;
  }
  /** True once [DONE] arrived or a non-empty finish_reason was reported. */
  get completed() {
    return this.done || this.finishReason !== null;
  }
  push(chunk) {
    const output = [];
    for (const char of chunk) {
      if (this.done) break;
      if (this.afterCR) {
        this.afterCR = false;
        if (char === "\n") continue;
      }
      if (char === "\r" || char === "\n") {
        this.consumeLine(output);
        this.afterCR = char === "\r";
      } else {
        this.line += char;
      }
    }
    return output;
  }
  finish() {
    const output = [];
    if (!this.done) {
      if (this.line) this.consumeLine(output);
      this.dispatch(output);
    }
    return output;
  }
  consumeLine(output) {
    const line = this.line;
    this.line = "";
    if (!line) {
      this.dispatch(output);
      return;
    }
    const colon = line.indexOf(":");
    const field = colon < 0 ? line : line.slice(0, colon);
    if (field !== "data") return;
    let value = colon < 0 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    this.data.push(value);
  }
  dispatch(output) {
    const data = this.data.join("\n");
    this.data = [];
    if (!data.trim()) return;
    if (data.trim() === "[DONE]") {
      this.done = true;
      return;
    }
    let event;
    try {
      event = JSON.parse(data);
    } catch {
      throw new ChatError("\u6D41\u5F0F\u54CD\u5E94\u683C\u5F0F\u65E0\u6548\uFF0C\u8BF7\u68C0\u67E5\u670D\u52A1\u662F\u5426\u517C\u5BB9 OpenAI Chat Completions\u3002");
    }
    if (typeof event !== "object" || event === null) {
      throw new ChatError("\u6D41\u5F0F\u54CD\u5E94\u683C\u5F0F\u65E0\u6548\uFF0C\u8BF7\u68C0\u67E5\u63A5\u53E3\u5730\u5740\u3002");
    }
    const message = event;
    if (message.error) throw new ChatError("\u670D\u52A1\u8FD4\u56DE\u6D41\u5F0F\u9519\u8BEF\uFF0C\u8BF7\u68C0\u67E5\u914D\u7F6E\u6216\u7A0D\u540E\u91CD\u8BD5\u3002");
    if (message.choices !== void 0 && !Array.isArray(message.choices)) {
      throw new ChatError("\u6D41\u5F0F\u54CD\u5E94\u683C\u5F0F\u65E0\u6548\uFF0C\u8BF7\u68C0\u67E5\u63A5\u53E3\u5730\u5740\u3002");
    }
    const finish = message.choices?.[0]?.finish_reason;
    if (typeof finish === "string" && finish) this.finishReason = finish;
    const content = message.choices?.[0]?.delta?.content;
    if (typeof content === "string" && content) output.push(content);
  }
};

// src/lib/chat.ts
async function streamChat(options, fetchImpl = createDefaultFetch()) {
  if (!options.apiKey.trim()) throw new ChatError("\u8BF7\u5148\u5728\u63D2\u4EF6\u8BBE\u7F6E\u4E2D\u914D\u7F6E API Key\u3002");
  const baseUrl = options.baseUrl.trim().replace(/\/+$/, "");
  let url;
  try {
    url = new URL(`${baseUrl}/chat/completions`);
  } catch {
    throw new ChatError("\u63A5\u53E3\u5730\u5740\u65E0\u6548\uFF0C\u8BF7\u5728\u8BBE\u7F6E\u4E2D\u586B\u5199\u5B8C\u6574\u7684 Base URL\u3002");
  }
  if (!["https:", "http:"].includes(url.protocol)) throw new ChatError("\u63A5\u53E3\u5730\u5740\u5FC5\u987B\u4F7F\u7528 HTTP \u6216 HTTPS\u3002");
  if (!options.model.trim()) throw new ChatError("\u8BF7\u5148\u5728\u63D2\u4EF6\u8BBE\u7F6E\u4E2D\u586B\u5199\u6A21\u578B\u540D\u79F0\u3002");
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) abort();
  const timeoutSec = Number.isFinite(options.timeoutSec) && options.timeoutSec > 0 ? Math.min(options.timeoutSec, 3600) : 60;
  const timer = setTimeout(abort, timeoutSec * 1e3);
  let reader;
  const checkAbort = () => {
    if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
  };
  const cancelReader = () => {
    void reader?.cancel().catch(() => {
    });
  };
  controller.signal.addEventListener("abort", cancelReader, { once: true });
  try {
    checkAbort();
    const response = await fetchImpl(url.href, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${options.apiKey.trim()}` },
      body: JSON.stringify({
        model: options.model.trim(),
        stream: true,
        messages: [
          { role: "system", content: options.systemPrompt },
          ...options.history.map(({ role, content }) => ({ role, content }))
        ]
      }),
      signal: controller.signal
    });
    checkAbort();
    if (!response.ok) {
      await response.body?.cancel().catch(() => {
      });
      throw new HttpError(response.status);
    }
    if (!response.body) throw new ChatError("\u670D\u52A1\u672A\u8FD4\u56DE\u6D41\u5F0F\u5185\u5BB9\uFF0C\u8BF7\u68C0\u67E5\u63A5\u53E3\u914D\u7F6E\u3002");
    reader = response.body.getReader();
    const decoder = new TextDecoder();
    const parser = new SSEParser();
    let text = "";
    const emit = (parts) => {
      for (const part of parts) {
        text += part;
        options.onDelta(part);
      }
    };
    while (!parser.done) {
      checkAbort();
      const { done, value } = await reader.read();
      checkAbort();
      if (done) {
        emit(parser.push(decoder.decode()));
        emit(parser.finish());
        if (!parser.completed) throw new ChatError("\u54CD\u5E94\u6D41\u610F\u5916\u4E2D\u65AD\uFF0C\u8BF7\u91CD\u8BD5\u3002");
        break;
      }
      emit(parser.push(decoder.decode(value, { stream: true })));
    }
    return text;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
    controller.signal.removeEventListener("abort", cancelReader);
    if (reader) {
      try {
        await reader.cancel();
      } catch {
      }
      reader.releaseLock();
    }
  }
}

// src/settings.ts
var import_core = require("@typora-community-plugin/core");
var DEFAULT_SETTINGS = {
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o-mini",
  systemPrompt: "\u4F60\u662F\u6587\u6863\u89E3\u8BFB\u52A9\u624B\u3002\u8BF7\u89E3\u8BFB\u7528\u6237\u63D0\u4F9B\u7684\u6587\u6863\u5185\u5BB9\uFF0C\u8BB2\u6E05\u7ED3\u6784\u4E0E\u8981\u70B9\uFF0C\u7528\u4E2D\u6587\u56DE\u7B54\u3002",
  timeoutSec: 60
};
var PluginSettingTab = class extends import_core.SettingTab {
  constructor(_app, owner) {
    super();
    this.owner = owner;
  }
  get name() {
    return this.owner.manifest.name;
  }
};
var AiDocSettingTab = class extends PluginSettingTab {
  constructor(app, plugin, store) {
    super(app, plugin);
    this.store = store;
  }
  onshow() {
    this.containerEl.replaceChildren();
    this.addSettingTitle("AI \u6587\u6863\u89E3\u8BFB\u4FA7\u8FB9\u680F");
    const status = document.createElement("p");
    status.setAttribute("role", "status");
    const save = (key, value) => {
      try {
        this.store.set(key, value);
        this.store.save();
        status.textContent = "\u8BBE\u7F6E\u5DF2\u4FDD\u5B58";
      } catch {
        status.textContent = "\u8BBE\u7F6E\u4FDD\u5B58\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u914D\u7F6E\u76EE\u5F55\u5199\u5165\u6743\u9650\u3002";
      }
    };
    this.addSetting((s) => {
      s.addName("Base URL");
      s.addDescription("OpenAI \u517C\u5BB9\u63A5\u53E3\u6839\u5730\u5740\uFF0C\u901A\u5E38\u4EE5 /v1 \u7ED3\u5C3E\uFF1B\u4E0D\u5305\u542B /chat/completions\u3002");
      s.addText((input) => {
        input.value = this.store.get("baseUrl");
        input.placeholder = DEFAULT_SETTINGS.baseUrl;
        input.setAttribute("aria-label", "Base URL");
        input.onchange = () => save("baseUrl", input.value.trim());
      });
    });
    this.addSetting((s) => {
      s.addName("API Key");
      s.addDescription("\u7531 core \u4FDD\u5B58\u5728\u672C\u5730\u8BBE\u7F6E\u6587\u4EF6\u4E2D\uFF1B\u5BC6\u7801\u6846\u4EC5\u9690\u85CF\u663E\u793A\uFF0C\u4E0D\u4EE3\u8868\u52A0\u5BC6\u5B58\u50A8\u3002");
      s.addInput("password", (input) => {
        input.value = this.store.get("apiKey");
        input.autocomplete = "off";
        input.setAttribute("aria-label", "API Key");
        input.onchange = () => save("apiKey", input.value.trim());
      });
    });
    this.addSetting((s) => {
      s.addName("\u6A21\u578B");
      s.addDescription("\u586B\u5199\u670D\u52A1\u652F\u6301\u7684\u6A21\u578B\u540D\u79F0\u3002");
      s.addText((input) => {
        input.value = this.store.get("model");
        input.placeholder = DEFAULT_SETTINGS.model;
        input.setAttribute("aria-label", "\u6A21\u578B");
        input.onchange = () => save("model", input.value.trim());
      });
    });
    this.addSetting((s) => {
      s.addName("\u7CFB\u7EDF\u63D0\u793A\u8BCD");
      s.addDescription("\u4F5C\u4E3A\u6BCF\u6B21\u8BF7\u6C42\u7684 system \u6D88\u606F\uFF1B\u4E0D\u4F1A\u81EA\u52A8\u8BFB\u53D6\u6587\u6863\u3002");
      s.addTextArea((input) => {
        input.value = this.store.get("systemPrompt");
        input.rows = 5;
        input.setAttribute("aria-label", "\u7CFB\u7EDF\u63D0\u793A\u8BCD");
        input.onchange = () => save("systemPrompt", input.value);
      });
    });
    this.addSetting((s) => {
      s.addName("\u8D85\u65F6\u65F6\u95F4\uFF08\u79D2\uFF09");
      s.addDescription("\u6574\u4E2A\u8BF7\u6C42\uFF08\u5305\u62EC\u6D41\u5F0F\u8F93\u51FA\uFF09\u7684\u65F6\u9650\uFF0C1\u20133600 \u79D2\u3002");
      s.addInput("number", (input) => {
        input.value = String(this.store.get("timeoutSec"));
        input.min = "1";
        input.max = "3600";
        input.step = "1";
        input.setAttribute("aria-label", "\u8D85\u65F6\u65F6\u95F4\uFF08\u79D2\uFF09");
        input.onchange = () => {
          const value = Number(input.value);
          if (!Number.isInteger(value) || value < 1 || value > 3600) {
            status.textContent = "\u8D85\u65F6\u65F6\u95F4\u8BF7\u8F93\u5165 1\u20133600 \u4E4B\u95F4\u7684\u6574\u6570\u3002";
            return;
          }
          save("timeoutSec", value);
        };
      });
    });
    this.containerEl.append(status);
  }
};

// src/panel.ts
var AiDocPanel = class extends import_core2.SidebarPanel {
  constructor(app, owner) {
    super(app.workspace.ribbon, app.workspace.sidebar);
    this.owner = owner;
    this.history = [];
    this.generation = 0;
    this.streaming = false;
    this.disposed = false;
    this.containerEl = document.createElement("section");
    this.containerEl.className = "ai-doc-sidebar";
    this.containerEl.setAttribute("aria-label", "AI \u6587\u6863\u89E3\u8BFB\u4FA7\u8FB9\u680F");
    const icon = document.createElement("span");
    icon.textContent = "AI";
    icon.className = "ai-doc-sidebar-icon";
    this.addRibbonButton({ id: "ai-doc-sidebar", title: "AI \u6587\u6863\u89E3\u8BFB\u4FA7\u8FB9\u680F", icon });
    const title = document.createElement("h2");
    title.textContent = "AI \u6587\u6863\u89E3\u8BFB";
    const description = document.createElement("p");
    description.className = "ai-doc-sidebar-description";
    description.textContent = "\u9009\u4E2D\u6587\u5B57\u586B\u5165\uFF0C\u6216\u76F4\u63A5\u8F93\u5165\u95EE\u9898\u3002\u70B9\u51FB\u53D1\u9001\u540E\u624D\u4F1A\u63D0\u4EA4\u3002";
    this.messages = document.createElement("div");
    this.messages.className = "ai-doc-sidebar-messages";
    this.messages.setAttribute("role", "log");
    this.messages.setAttribute("aria-label", "\u5BF9\u8BDD\u6D88\u606F");
    this.messages.setAttribute("aria-live", "polite");
    this.input = document.createElement("textarea");
    this.input.rows = 5;
    this.input.placeholder = "\u7C98\u8D34\u6587\u6863\u7247\u6BB5\u6216\u8F93\u5165\u95EE\u9898\u2026";
    this.input.setAttribute("aria-label", "\u6D88\u606F\u8F93\u5165");
    const actions = document.createElement("div");
    actions.className = "ai-doc-sidebar-actions";
    this.sendButton = document.createElement("button");
    this.sendButton.textContent = "\u53D1\u9001";
    this.sendButton.className = "ai-doc-sidebar-send";
    const selectionButton = document.createElement("button");
    selectionButton.textContent = "\u586B\u5165\u9009\u4E2D";
    const clearButton = document.createElement("button");
    clearButton.textContent = "\u6E05\u7A7A\u5BF9\u8BDD";
    for (const button of [this.sendButton, selectionButton, clearButton]) button.type = "button";
    actions.append(this.sendButton, selectionButton, clearButton);
    const hint = document.createElement("small");
    hint.textContent = "Enter \u53D1\u9001 \xB7 Shift+Enter \u6362\u884C";
    this.status = document.createElement("p");
    this.status.className = "ai-doc-sidebar-status";
    this.status.setAttribute("role", "status");
    this.containerEl.append(title, description, this.messages, this.input, actions, hint, this.status);
    owner.registerDomEvent(this.sendButton, "click", () => {
      void this.send();
    });
    owner.registerDomEvent(this.input, "keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
        event.preventDefault();
        void this.send();
      }
    });
    owner.registerDomEvent(selectionButton, "mousedown", (event) => {
      if (event.button === 0) event.preventDefault();
    });
    owner.registerDomEvent(selectionButton, "click", () => {
      try {
        const selected = getSelectedText();
        if (!selected.trim()) {
          this.status.textContent = "\u8BF7\u5148\u9009\u4E2D\u6587\u5B57";
          return;
        }
        this.input.value = selected;
        this.status.textContent = "\u5DF2\u586B\u5165\u9009\u4E2D\u6587\u5B57\uFF0C\u70B9\u51FB\u53D1\u9001\u540E\u63D0\u4EA4\u3002";
        this.input.focus();
      } catch {
        this.status.textContent = "\u65E0\u6CD5\u8BFB\u53D6\u9009\u4E2D\u6587\u5B57\uFF0C\u8BF7\u624B\u52A8\u7C98\u8D34\u3002";
      }
    });
    owner.registerDomEvent(clearButton, "click", () => this.clear());
    owner.register(() => this.dispose());
  }
  bubble(role, text) {
    const article = document.createElement("article");
    article.className = `ai-doc-sidebar-message ai-doc-sidebar-${role}`;
    const label = document.createElement("strong");
    label.textContent = role === "user" ? "\u4F60" : "\u52A9\u624B";
    const body = document.createElement("div");
    body.className = "ai-doc-sidebar-content";
    body.textContent = text;
    article.append(label, body);
    this.messages.append(article);
    this.scrollToBottom();
    return body;
  }
  scrollToBottom() {
    this.messages.scrollTop = this.messages.scrollHeight;
  }
  setStreaming(value) {
    this.streaming = value;
    this.sendButton.disabled = value;
    this.sendButton.textContent = value ? "\u53D1\u9001\u4E2D\u2026" : "\u53D1\u9001";
    this.messages.setAttribute("aria-busy", String(value));
  }
  async send() {
    if (this.disposed || this.streaming) return;
    const content = this.input.value;
    if (!content.trim()) {
      this.status.textContent = "\u8BF7\u8F93\u5165\u6D88\u606F\u540E\u518D\u53D1\u9001";
      return;
    }
    let assistant;
    const generation = ++this.generation;
    let answer = "";
    try {
      const settings = Object.fromEntries(Object.entries(DEFAULT_SETTINGS).map(([key, fallback]) => [key, this.owner.settings.get(key) ?? fallback]));
      if (!settings.apiKey.trim()) {
        this.bubble("assistant", "\u8BF7\u5148\u5728\u63D2\u4EF6\u8BBE\u7F6E\u4E2D\u914D\u7F6E API Key\u3002");
        return;
      }
      this.bubble("user", content);
      assistant = this.bubble("assistant", "\u6B63\u5728\u601D\u8003\u2026");
      this.input.value = "";
      this.status.textContent = "";
      this.controller = new AbortController();
      this.setStreaming(true);
      const history = [...this.history, { role: "user", content }];
      const result = await streamChat({
        ...settings,
        history,
        signal: this.controller.signal,
        onDelta: (delta) => {
          if (this.disposed || this.generation !== generation) return;
          answer += delta;
          assistant.textContent = answer;
          this.scrollToBottom();
        }
      });
      if (this.disposed || this.generation !== generation) return;
      if (!result) throw new ChatError("\u670D\u52A1\u672A\u8FD4\u56DE\u6587\u5B57\u5185\u5BB9\uFF0C\u8BF7\u68C0\u67E5\u6A21\u578B\u540E\u91CD\u8BD5\u3002");
      this.history = [...history, { role: "assistant", content: result }];
    } catch (error) {
      if (this.disposed || this.generation !== generation) return;
      const message = toChineseError(error);
      const body = assistant ?? this.bubble("assistant", "");
      body.textContent = answer ? `${answer}

${message}` : message;
      body.classList.add("ai-doc-sidebar-error");
      this.status.textContent = "\u53D1\u9001\u5931\u8D25\uFF0C\u53EF\u91CD\u65B0\u8F93\u5165\u6216\u7C98\u8D34\u540E\u91CD\u8BD5\u3002";
      this.scrollToBottom();
    } finally {
      if (!this.disposed && this.generation === generation) {
        this.controller = void 0;
        this.setStreaming(false);
      }
    }
  }
  clear() {
    this.generation++;
    this.controller?.abort();
    this.controller = void 0;
    this.history = [];
    this.messages.replaceChildren();
    this.input.value = "";
    this.status.textContent = "\u5BF9\u8BDD\u5DF2\u6E05\u7A7A";
    this.setStreaming(false);
  }
  dispose() {
    this.disposed = true;
    this.generation++;
    this.controller?.abort();
    this.controller = void 0;
    this.history = [];
    this.containerEl.remove();
  }
};

// src/main.ts
var AiDocSidebarPlugin = class extends import_core3.Plugin {
  onload() {
    const settings = new import_core3.PluginSettings(this.app, this.manifest, { version: 1 });
    settings.setDefault(DEFAULT_SETTINGS);
    this.registerSettings(settings);
    this.registerSettingTab(new AiDocSettingTab(this.app, this, settings));
    const panel = new AiDocPanel(this.app, this);
    this.register(this.app.workspace.sidebar.addPanel(panel));
  }
};
export default module.exports.default;
