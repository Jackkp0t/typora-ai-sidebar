# AI 文档解读侧边栏

Typora Community Plugin MVP，插件 ID：`ai-doc-sidebar`。在侧边栏中输入问题或手动填入选中文字，通过 OpenAI 兼容的 Chat Completions 接口流式解读文档。

仓库：https://github.com/Jackkp0t/typora-ai-sidebar

## 克隆与安装

```bash
git clone https://github.com/Jackkp0t/typora-ai-sidebar.git
cd typora-ai-sidebar
```

克隆后可以直接加载已提交的插件，不必先构建：

- 将 `dist/ai-doc-sidebar` **整个文件夹**复制到 Typora 插件目录；或
- 使用仓库根目录的 [`typora-ai-sidebar.zip`](https://github.com/Jackkp0t/typora-ai-sidebar/blob/main/typora-ai-sidebar.zip)（约数 KB）。解压后得到 `ai-doc-sidebar/`，再把该文件夹放进插件目录。

需要在本机重新构建或重新打包时（需要 Node.js **22.7+** 和 npm）：

```bash
npm install
npm test
npm run build
npm run zip
```

- `npm run build` 生成 `dist/ai-doc-sidebar`（`main.js`、`manifest.json`、`style.css`）。
- `npm run zip` 会先构建，再在仓库根目录写出 `typora-ai-sidebar.zip`。ZIP 内是 `ai-doc-sidebar/`，与 `dist/ai-doc-sidebar` 一致。
- `npm test` 会先执行构建，再用 Node 原生测试跑单元测试，不需要 API Key。
- 另有 `npm run typecheck`（`tsc --noEmit`）。

`@typora-community-plugin/core` 是开发依赖，版本范围 `~2.10.0`，允许安装最新 2.10.x。本次核对的真实 npm 包版本为 **2.10.84**。core 由 Typora 提供，不打入插件；安装插件时无需复制 `node_modules`。

构建产物：

```text
dist/
└── ai-doc-sidebar/
    ├── main.js
    ├── manifest.json
    └── style.css
typora-ai-sidebar.zip
```

开发与验收过程中的环境记录见 [NOTES.md](NOTES.md)。

## 安装到 Typora

1. 先安装 **Typora Community Plugin Core 2.10.x**。从[官方仓库 Releases](https://github.com/typora-community-plugin/typora-community-plugin/releases)下载 core 安装包，按其 `README.zh-CN.md` 和[官方安装指南](https://github.com/typora-community-plugin/typora-community-plugin/blob/main/docs/zh-cn/user-guide/1a-installation.md)运行对应系统的安装脚本。`npm install` 只安装开发依赖，不会将 core 安装进 Typora。
2. 关闭 Typora。从本仓库 https://github.com/Jackkp0t/typora-ai-sidebar 取得 `dist/ai-doc-sidebar`（克隆后即有，或执行 `npm run build`），将**整个文件夹**复制进插件目录。也可将 `typora-ai-sidebar.zip` 解压到插件目录（仓库已附带该 ZIP，也可执行 `npm run zip` 重新生成）。
3. 最直接的是笔记库安装：当前笔记库根目录的 `.typora/plugins/`。安装后应为 `<笔记库>/.typora/plugins/ai-doc-sidebar/main.js`，同级还有 `manifest.json` 和 `style.css`。
4. 如需全局安装，使用 core 当前实例的 `app.plugins.globalPluginsDir`。按 **Shift+F12** 打开 Typora 开发者工具，在 Console 中执行下式查看实际目录（可受 core 的 `PLUGIN_GLOBAL_DIR` 配置影响）：

   ```js
   globalThis[Symbol.for('typora-plugin-core@v2')].app.plugins.globalPluginsDir
   ```

   [官方插件安装文档](https://github.com/typora-community-plugin/typora-community-plugin/blob/main/docs/zh-cn/user-guide/2-plugin-installation.md)列出传统全局目录 `~/.typora/community-plugins/plugins`；当前[加载器](https://github.com/typora-community-plugin/typora-community-plugin/blob/main/packages/core/src/plugin/plugin-manager.ts)则使用运行时计算的目录，因此以 Console 显示的路径为准。
5. 重新启动 Typora，打开 core 设置（默认 `Ctrl+.`）→「已安装插件」，启用「AI 文档解读侧边栏」。点击 Ribbon 中的 **AI** 按钮打开面板。

不要在插件目录中再嵌套 `dist/`。正确结构是 `plugins/ai-doc-sidebar/manifest.json`。

## 配置

在 core 设置中的「AI 文档解读侧边栏」页面配置，修改后移开焦点即保存：

| 设置 | 默认值 | 说明 |
| --- | --- | --- |
| Base URL | `https://api.openai.com/v1` | 兼容接口根地址，不含 `/chat/completions` |
| API Key | 空 | 必填，使用密码框显示 |
| 模型 | `gpt-4o-mini` | 服务支持的模型名称 |
| 系统提示词 | 你是文档解读助手。请解读用户提供的文档内容，讲清结构与要点，用中文回答。 | 每次请求的 system 消息 |
| 超时时间 | `60` 秒 | 整个流式请求时限，可配置 1–3600 秒 |

API Key 由 core 保存到本地设置文件，密码框仅隐藏显示，设置文件并未加密。本插件不记录 Key 或服务端原始错误内容。

> **注意：**
> - 设置修改后由 core 约 **1 秒防抖**再写盘；改完请稍等 1 秒以上再关闭 Typora，否则最后一次修改可能未保存。
> - 若插件安装在**笔记库内**（`<笔记库>/.typora/plugins/`），API Key 会以**明文**保存在该笔记库的 `.typora` 目录中。同步、分享或提交该笔记库（如 Git、网盘）前请排除 `.typora/`，或改用全局安装。

## 使用

「填入选中」先读普通选区；源码模式、代码块、公式块中的选中内容会回退到 Typora 的 CodeMirror 实例读取。

- 选中文档文字，点击「填入选中」将其复制到输入框；未选中时提示「请先选中文字」。填入本身不发请求。
- 在输入框中编辑后点击「发送」，或按 Enter。Shift+Enter 换行；中文输入法候选确认不会触发发送。
- 助手消息实时追加流式内容；输出期间禁用发送，可继续编辑下一条草稿。
- 「清空对话」会取消当前请求并清除本次会话、消息和输入框；旧请求结果不会重新出现。禁用插件也会取消请求并清理面板、按钮和事件。
- 缺少 API Key 时会提示前往插件设置，保留输入，不发送请求。HTTP、网络和超时错误会显示在助手气泡中。

请求只包含配置的 system 提示词、当前明确发送的内容和已成功完成的会话轮次。不会自动读取整篇文档、文件路径、剪贴板或尚未发送的选中文字/草稿；错误气泡和失败轮次不进入后续请求。会话仅保存在内存中，不跨重启保存；切换文档仍保留同一面板会话，需要时请清空。

MVP 将模型输出作为纯文本显示，保留换行，不执行 HTML，也不渲染 Markdown。

## 调试与验收

按 **Shift+F12** 打开 Typora 开发者工具：

1. Console 检查插件加载错误，确认 core 已安装且为 2.10.x。
2. Network 检查 `POST <Base URL>/chat/completions`，请求体应有 `stream: true` 和预期的 `messages`。不要分享包含 Authorization 的截图或日志。
3. 连接失败时检查 Base URL、模型、网络和服务端 CORS 设置。浏览器 `fetch` 无法绕过服务端跨域限制。
4. 检查缺 Key、空选区、Enter/Shift+Enter、中文输入法、流式禁用发送、清空取消、错误气泡、禁用后重新启用。

`npm test` 用 esbuild 编译 TypeScript 测试，再运行 Node 原生 `node --test`，无需 API Key 和网络。覆盖 SSE 分片/CRLF/多 data 行/DONE/finish_reason 结束（无 DONE）/异常事件、选区读取（含 CodeMirror 回退）、中文错误映射，以及请求体、UTF-8、超时、取消和截断流。当前环境未运行真实 Typora，安装后的桌面验收仍需按上述步骤执行。

## 源码

- `src/main.ts`：插件注册与资源生命周期。
- `src/settings.ts`：默认设置、设置页及公开 API 适配。
- `src/panel.ts`：侧边栏交互、流式气泡、内存会话。
- `src/lib/sse.ts`、`errors.ts`、`chat.ts`：独立可测试的解析、错误与请求逻辑。
- `scripts/`：构建、测试及 ZIP 打包，无 Typora 运行时依赖。
