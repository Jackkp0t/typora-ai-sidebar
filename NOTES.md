# API 核对与环境记录

## 已读取的真实定义

读取了 npm 缓存中真实发布的 `@typora-community-plugin/core@2.10.84`，并放入 `node_modules/@typora-community-plugin/core`。缓存 registry 元数据的 `latest` 也为 `2.10.84`；因网络不可达，无法重新在线确认。

已逐个读取 `typings/` 下用户指定的文件：

- `plugin/plugin.d.ts`、`plugin/plugin-manifest.d.ts`、`plugin/plugin-settings.d.ts`
- `settings/settings.d.ts`
- `ui/sidebar/sidebar.d.ts`、`ui/sidebar/sidebar-panel.d.ts`
- `ui/settings/setting-tab.d.ts`、`ui/settings/setting-item.d.ts`
- `ui/ribbon/workspace-ribbon.d.ts`
- `app.d.ts`、`index.d.ts`

同时核对了 `common/component.d.ts`、`ui/common/view.d.ts`、`utils/store.d.ts`、`ui/workspace.d.ts` 和上游对应实现。

## 与初始假设的差异

1. **PluginSettingTab 没有公开导出。** 内部声明确有此类，但真实 `index.d.ts` 与[上游入口](https://github.com/typora-community-plugin/typora-community-plugin/blob/main/packages/core/src/index.ts)仅导出 `SettingTab`。无法在运行时从 core 导入 `PluginSettingTab`，也不能导入只含 `.d.ts` 的内部路径。`src/settings.ts` 使用本地 `PluginSettingTab` 薄适配类，继承真实公开的 `SettingTab`，仅补齐内部类的构造参数与 name getter，再由实际设置页继承。所有控件均调用真实 `addSetting/addName/addDescription/addText/addInput/addTextArea`，未扩充 core 声明或假定缺失 API 存在。
2. **加载器要求 ESM 默认导出。** [PluginManager](https://github.com/typora-community-plugin/typora-community-plugin/blob/main/packages/core/src/plugin/plugin-manager.ts)动态 `import(main.js)` 并实例化 `module.default`，不是普通 Node CommonJS 加载。构建先由 esbuild 生成 CJS 代码并将 core 标为 external，再加小型局部 `module/require` 包装与 ESM 默认导出。这个 require 只解析 core 到 `globalThis[Symbol.for('typora-plugin-core@v2')]`，其注册位置已核对[上游 app.ts](https://github.com/typora-community-plugin/typora-community-plugin/blob/main/packages/core/src/app.ts)。产物无需 Node 全局、npm 包或裸模块解析，可供 macOS 使用。未依赖仅开发模式存在的 `window.Typora`。
3. **SidebarPanel 不是 Component。** 它继承新版 View，不具备 `register/registerDomEvent`。事件和 dispose 都注册到插件实例；`sidebar.addPanel(panel)` 的 DisposeFunc 也通过插件 `register` 注册。Ribbon icon 必须是 `HTMLElement`。面板自行创建 `containerEl`；`onshow/onhide` 是显示生命周期，不在这些回调中重置会话。
4. **默认值在加载前设置。** `settings.setDefault(DEFAULT_SETTINGS)` 在 `registerSettings` 之前，因为真实 `registerSettings` 会立即调用 `load()`。设置持久化使用同步 `set/save`。
5. **全局目录存在文档版本差异。** npm 包 README 仅给出简介，无安装目录。README 已引用上游安装文档，并提供真实运行时 `app.plugins.globalPluginsDir` 查询方式，避免把固定历史路径当作所有系统通用目录。笔记库安装使用 `.typora/plugins/`。
6. **manifest 发布身份已填写。** `authorUrl` 为 `https://github.com/Jackkp0t`，`repo` 为 `Jackkp0t/typora-ai-sidebar`。插件仍通过手动复制 `dist/ai-doc-sidebar` 或解压 `typora-ai-sidebar.zip` 安装。

## 当前环境限制与验证范围

- 已执行 `npm install`，并用短超时重试；registry 的 DNS 请求报 `EAI_AGAIN`，按固定 IP 连接也不可达。`npm install --offline` 因缺少 `@types/node` 和 core 的 `@plylrnsdy/decorate.js` 缓存而失败。**不能声称完整 npm install 成功，也未伪造 package-lock。** 正常联网环境可用项目 package.json 执行标准安装。
- 为完成本地验证，core 从原始缓存 tarball 解包；`node_modules/esbuild` 临时链接到本机预装的真实 **esbuild-wasm 0.25.9**，ZIP 库链接到预装 **JSZip**，均位于被忽略的 node_modules 中。项目 package.json 仍声明可正常安装的标准 esbuild/TypeScript/JSZip，不含本机绝对路径。
- 预装 esbuild 的 JS service API 在此环境中不返回，但 CLI 正常；构建/测试通过 esbuild CLI 执行，正常 npm 安装的原生 esbuild 同样支持。
- 受限环境中 Node 测试的默认子进程隔离没有报告具体用例。改用 Node 22.7+ 的测试隔离关闭（`--test-isolation=none`，部分 22.x 构建为 `--experimental-test-isolation=none`）后，实际报告并执行全部命名用例，避免把仅文件级退出成功误认为测试通过。`scripts/test.mjs` 会探测当前 Node 接受的开关名。
- `npm run typecheck` 无法在本环境完成：预装 TypeScript 是指向缺失的 `@typescript/old` 的包装包，无法执行；网络也无法安装正常版本。esbuild 完成 TS 转换与打包，但不等同完整类型检查。
- 尝试启动 Chrome/Chromium 做浏览器验收，被沙箱系统调用权限阻止（`setsockopt: Operation not permitted` / 进程退出）。没有真实 Typora 运行环境，也没有用户 API Key；未做桌面或真实联网请求验收。所有请求测试使用标准 Response/ReadableStream 模拟服务。
- 本次已通过 `npm run build`、`npm test`（**22 个命名测试**）和 `npm run zip`，并验证 ZIP 三个文件与 dist 完全相同。额外测试实际导入构建产物，检查 ESM 默认类与 core Symbol bridge；这个测试仅使用 core 模块边界替身，不等于真实 Typora 验收。

## 协议约定

- 服务须兼容 OpenAI Chat Completions SSE，输出 `choices[0].delta.content`，以 `[DONE]` 结束；无 DONE 的 EOF 被视为截断流，不把部分回答写入会话。
- 超时覆盖响应头等待与整个响应体；清空或卸载也会取消流。错误仅以中文安全说明显示，不回显服务端原始 body。
- API Key 使用 core 的普通本地设置持久化，不是操作系统密钥库。设置页已直接说明这一点。

## 更新（联网复验）

在有网络的环境中已重新执行完整 `npm install`、`npm run build`、`npm test`（22 通过）、`npm run typecheck`（修复 settings.ts 中 Plugin 泛型问题后通过）与 `npm run zip`。上文关于 npm install / typecheck 无法完成的限制已解决；真实 Typora 验收仍待完成。
