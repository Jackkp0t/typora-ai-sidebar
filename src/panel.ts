import { getSelectedText } from './lib/selection';
import { SidebarPanel, type App, type Plugin } from '@typora-community-plugin/core';
import { streamChat, type ChatMessage } from './lib/chat';
import { ChatError, toChineseError } from './lib/errors';
import { DEFAULT_SETTINGS, type Settings } from './settings';

export class AiDocPanel extends SidebarPanel {
  private readonly messages: HTMLDivElement;
  private readonly input: HTMLTextAreaElement;
  private readonly sendButton: HTMLButtonElement;
  private readonly status: HTMLParagraphElement;
  private history: ChatMessage[] = [];
  private controller?: AbortController;
  private generation = 0;
  private streaming = false;
  private disposed = false;

  constructor(app: App, private readonly owner: Plugin<Settings>) {
    super(app.workspace.ribbon, app.workspace.sidebar);
    this.containerEl = document.createElement('section');
    this.containerEl.className = 'ai-doc-sidebar';
    this.containerEl.setAttribute('aria-label', 'AI 文档解读侧边栏');
    const icon = document.createElement('span');
    icon.textContent = 'AI';
    icon.className = 'ai-doc-sidebar-icon';
    this.addRibbonButton({ id: 'ai-doc-sidebar', title: 'AI 文档解读侧边栏', icon });

    const title = document.createElement('h2');
    title.textContent = 'AI 文档解读';
    const description = document.createElement('p');
    description.className = 'ai-doc-sidebar-description';
    description.textContent = '选中文字填入，或直接输入问题。点击发送后才会提交。';
    this.messages = document.createElement('div');
    this.messages.className = 'ai-doc-sidebar-messages';
    this.messages.setAttribute('role', 'log');
    this.messages.setAttribute('aria-label', '对话消息');
    this.messages.setAttribute('aria-live', 'polite');
    this.input = document.createElement('textarea');
    this.input.rows = 5;
    this.input.placeholder = '粘贴文档片段或输入问题…';
    this.input.setAttribute('aria-label', '消息输入');
    const actions = document.createElement('div');
    actions.className = 'ai-doc-sidebar-actions';
    this.sendButton = document.createElement('button');
    this.sendButton.textContent = '发送';
    this.sendButton.className = 'ai-doc-sidebar-send';
    const selectionButton = document.createElement('button');
    selectionButton.textContent = '填入选中';
    const clearButton = document.createElement('button');
    clearButton.textContent = '清空对话';
    for (const button of [this.sendButton, selectionButton, clearButton]) button.type = 'button';
    actions.append(this.sendButton, selectionButton, clearButton);
    const hint = document.createElement('small');
    hint.textContent = 'Enter 发送 · Shift+Enter 换行';
    this.status = document.createElement('p');
    this.status.className = 'ai-doc-sidebar-status';
    this.status.setAttribute('role', 'status');
    this.containerEl.append(title, description, this.messages, this.input, actions, hint, this.status);

    owner.registerDomEvent(this.sendButton, 'click', () => { void this.send(); });
    owner.registerDomEvent(this.input, 'keydown', (event: KeyboardEvent) => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
        event.preventDefault();
        void this.send();
      }
    });
    // Preserve the editor's live selection while the mouse clicks this control.
    owner.registerDomEvent(selectionButton, 'mousedown', (event: MouseEvent) => {
      if (event.button === 0) event.preventDefault();
    });
    owner.registerDomEvent(selectionButton, 'click', () => {
      try {
        const selected = getSelectedText();
        if (!selected.trim()) { this.status.textContent = '请先选中文字'; return; }
        this.input.value = selected;
        this.status.textContent = '已填入选中文字，点击发送后提交。';
        this.input.focus();
      } catch { this.status.textContent = '无法读取选中文字，请手动粘贴。'; }
    });
    owner.registerDomEvent(clearButton, 'click', () => this.clear());
    owner.register(() => this.dispose());
  }

  private bubble(role: 'user' | 'assistant', text: string): HTMLDivElement {
    const article = document.createElement('article');
    article.className = `ai-doc-sidebar-message ai-doc-sidebar-${role}`;
    const label = document.createElement('strong');
    label.textContent = role === 'user' ? '你' : '助手';
    const body = document.createElement('div');
    body.className = 'ai-doc-sidebar-content';
    body.textContent = text;
    article.append(label, body);
    this.messages.append(article);
    this.scrollToBottom();
    return body;
  }

  private scrollToBottom(): void { this.messages.scrollTop = this.messages.scrollHeight; }

  private setStreaming(value: boolean): void {
    this.streaming = value;
    this.sendButton.disabled = value;
    this.sendButton.textContent = value ? '发送中…' : '发送';
    this.messages.setAttribute('aria-busy', String(value));
  }

  private async send(): Promise<void> {
    if (this.disposed || this.streaming) return;
    const content = this.input.value;
    if (!content.trim()) { this.status.textContent = '请输入消息后再发送'; return; }
    let assistant: HTMLDivElement | undefined;
    const generation = ++this.generation;
    let answer = '';
    try {
      const settings = Object.fromEntries(Object.entries(DEFAULT_SETTINGS).map(([key, fallback]) =>
        [key, this.owner.settings.get(key as keyof Settings) ?? fallback])) as unknown as Settings;
      if (!settings.apiKey.trim()) {
        this.bubble('assistant', '请先在插件设置中配置 API Key。');
        return;
      }
      this.bubble('user', content);
      assistant = this.bubble('assistant', '正在思考…');
      this.input.value = '';
      this.status.textContent = '';
      this.controller = new AbortController();
      this.setStreaming(true);
      const history: ChatMessage[] = [...this.history, { role: 'user', content }];
      const result = await streamChat({
        ...settings, history, signal: this.controller.signal,
        onDelta: delta => {
          if (this.disposed || this.generation !== generation) return;
          answer += delta;
          assistant!.textContent = answer;
          this.scrollToBottom();
        },
      });
      if (this.disposed || this.generation !== generation) return;
      if (!result) throw new ChatError('服务未返回文字内容，请检查模型后重试。');
      this.history = [...history, { role: 'assistant', content: result }];
    } catch (error) {
      if (this.disposed || this.generation !== generation) return;
      const message = toChineseError(error);
      const body = assistant ?? this.bubble('assistant', '');
      body.textContent = answer ? `${answer}\n\n${message}` : message;
      body.classList.add('ai-doc-sidebar-error');
      this.status.textContent = '发送失败，可重新输入或粘贴后重试。';
      this.scrollToBottom();
    } finally {
      if (!this.disposed && this.generation === generation) {
        this.controller = undefined;
        this.setStreaming(false);
      }
    }
  }

  private clear(): void {
    this.generation++;
    this.controller?.abort();
    this.controller = undefined;
    this.history = [];
    this.messages.replaceChildren();
    this.input.value = '';
    this.status.textContent = '对话已清空';
    this.setStreaming(false);
  }

  private dispose(): void {
    this.disposed = true;
    this.generation++;
    this.controller?.abort();
    this.controller = undefined;
    this.history = [];
    this.containerEl.remove();
  }
}
