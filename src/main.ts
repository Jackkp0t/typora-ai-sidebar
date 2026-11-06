import { Plugin, PluginSettings } from '@typora-community-plugin/core';
import { AiDocPanel } from './panel';
import { AiDocSettingTab, DEFAULT_SETTINGS, type Settings } from './settings';

export default class AiDocSidebarPlugin extends Plugin<Settings> {
  onload(): void {
    const settings = new PluginSettings<Settings>(this.app, this.manifest, { version: 1 });
    settings.setDefault(DEFAULT_SETTINGS);
    this.registerSettings(settings);
    this.registerSettingTab(new AiDocSettingTab(this.app, this, settings));
    // style.css is injected automatically by the core plugin manager (it reads <pluginDir>/style.css); no manual registerCss to avoid double injection.
    const panel = new AiDocPanel(this.app, this);
    this.register(this.app.workspace.sidebar.addPanel(panel));
  }
}
