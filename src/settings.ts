import { SettingTab, type App, type Plugin, type PluginSettings } from '@typora-community-plugin/core';
import type { ChatSettings } from './lib/chat';

export type Settings = ChatSettings;
export const DEFAULT_SETTINGS: Settings = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
  systemPrompt: '你是文档解读助手。请解读用户提供的文档内容，讲清结构与要点，用中文回答。',
  timeoutSec: 60,
};

/**
 * Core 2.10.84 declares PluginSettingTab internally, but does not export it
 * from its runtime entry. This local adapter uses the public SettingTab API
 * and reproduces only that internal class's name/constructor contract.
 */
abstract class PluginSettingTab extends SettingTab {
  constructor(_app: App, private readonly owner: Plugin<any>) { super(); }
  get name(): string { return this.owner.manifest.name; }
}

export class AiDocSettingTab extends PluginSettingTab {
  constructor(app: App, plugin: Plugin<Settings>, private readonly store: PluginSettings<Settings>) {
    super(app, plugin);
  }

  onshow(): void {
    this.containerEl.replaceChildren();
    this.addSettingTitle('AI 文档解读侧边栏');
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    const save = <K extends keyof Settings>(key: K, value: Settings[K]) => {
      try {
        this.store.set(key, value);
        this.store.save();
        status.textContent = '设置已保存';
      } catch {
        status.textContent = '设置保存失败，请检查配置目录写入权限。';
      }
    };
    this.addSetting(s => {
      s.addName('Base URL');
      s.addDescription('OpenAI 兼容接口根地址，通常以 /v1 结尾；不包含 /chat/completions。');
      s.addText(input => {
        input.value = this.store.get('baseUrl');
        input.placeholder = DEFAULT_SETTINGS.baseUrl;
        input.setAttribute('aria-label', 'Base URL');
        input.onchange = () => save('baseUrl', input.value.trim());
      });
    });
    this.addSetting(s => {
      s.addName('API Key');
      s.addDescription('由 core 保存在本地设置文件中；密码框仅隐藏显示，不代表加密存储。');
      s.addInput('password', input => {
        input.value = this.store.get('apiKey');
        input.autocomplete = 'off';
        input.setAttribute('aria-label', 'API Key');
        input.onchange = () => save('apiKey', input.value.trim());
      });
    });
    this.addSetting(s => {
      s.addName('模型');
      s.addDescription('填写服务支持的模型名称。');
      s.addText(input => {
        input.value = this.store.get('model');
        input.placeholder = DEFAULT_SETTINGS.model;
        input.setAttribute('aria-label', '模型');
        input.onchange = () => save('model', input.value.trim());
      });
    });
    this.addSetting(s => {
      s.addName('系统提示词');
      s.addDescription('作为每次请求的 system 消息；不会自动读取文档。');
      s.addTextArea(input => {
        input.value = this.store.get('systemPrompt');
        input.rows = 5;
        input.setAttribute('aria-label', '系统提示词');
        input.onchange = () => save('systemPrompt', input.value);
      });
    });
    this.addSetting(s => {
      s.addName('超时时间（秒）');
      s.addDescription('整个请求（包括流式输出）的时限，1–3600 秒。');
      s.addInput('number', input => {
        input.value = String(this.store.get('timeoutSec'));
        input.min = '1'; input.max = '3600'; input.step = '1';
        input.setAttribute('aria-label', '超时时间（秒）');
        input.onchange = () => {
          const value = Number(input.value);
          if (!Number.isInteger(value) || value < 1 || value > 3600) {
            status.textContent = '超时时间请输入 1–3600 之间的整数。';
            return;
          }
          save('timeoutSec', value);
        };
      });
    });
    this.containerEl.append(status);
  }
}
