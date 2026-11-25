# 安全与隐私

## 设计边界

- **不直接联网**：插件不发起 HTTP/DNS/socket；`npm run audit` 会检查宿主代码没有直接网络调用
- **本地路由有访问检查**：DSH 暴露 `connection.requestRejection` 的宿主上，API 与上传入口会先校验请求来自已认证的 DSH 页面；未认证/跨站请求返回 401/403。没有该接口的新版宿主依赖其默认鉴权
- **不接收凭据**：不需要账号密码、Cookie、API Key
- **无遥测**：不上报使用情况、不写远程日志
- **只处理你选择的文件**：读取本地文件/上传副本，解析对话与附件
- **摘要例外**：只有你选择「摘要」压缩并配置了模型时，摘要请求才会通过 DSH 的模型服务发出；内容来自所选对话

## 读什么

- 你选择的导出文件（JSON / JSONL / ZIP），包括 ZIP 内按 `export_path` 读取的附件
- 上传后在插件数据目录里的副本
- 插件配置、模型/价格配置、本机校准文件
- DSH 会话目录（写入前做格式自检、借用系统提示词）

## 写什么

- DSH 会话日志（导入结果，含图片/文件附件引用）
- DSH 附件存储（导入的图片与文件）
- DSH 工作区目录（按对话标题创建，重复时编号）；摘要/完整存档还会写入工作区内的 `deepseek-memory/`（`manifest.json`、`memory.md`、可选 `thinking.md` 与分片）
- 插件数据目录（目录名沿用旧项目名 `dsh-deepseek-import`，避免升级丢失已有上传/设置/校准）：
  - Windows：`%LOCALAPPDATA%\dsh-deepseek-import`
  - Linux：`$XDG_DATA_HOME/dsh-deepseek-import` 或 `~/.local/share/dsh-deepseek-import`
  - macOS：`~/Library/Application Support/dsh-deepseek-import`
- 「插件配置 → 导入位置」是存放新工作区文件夹的父目录，默认在用户目录下的 `DeepSeek-Imports`
- 记忆文件的 manifest 只写来源文件名、标题、分支、轮次、摘要提示词名称/指纹、实际用量，以及摘要中途失败时的失败块/轮次/错误短文案；不写绝对路径、完整对话或提示词全文
- 自定义摘要预设保存在插件数据目录（`summary-presets.json`），不上传

## 附件

- 只从你选择的导出包读取；`export_path` 必须是包内相对路径
- 拒绝绝对路径、`..`、空路径；ZIP 中不存在的条目跳过
- 单个附件上限 64MB；超过、缺失或服务拒绝时只记提示，不中断导入
- 同一附件在一次导入中只保存一次
- 旧版官方导出和浏览器记录没有附件本体：前者只保留文件名，后者的 `signed_path` 不下载
- 附件写入 DSH 附件服务，不写到插件目录之外
- DSH 的 image/file content block 只接受附件引用，没有工作区路径变体，因此不会把附件复制进 `deepseek-memory/`；删除工作区不会删除 DSH 附件存储里的对象

## 上传副本

- 浏览器选择文件后会复制到插件数据目录的 `files/`
- 批量上传期间不会被清理
- 清理时保护：当前集合、最近列表、24 小时内的文件
- 其余副本在加载成功后 / 插件启动时清理
- 卸载插件不会自动删除已导入的 DSH 会话；按需在工作区删除

## ZIP 处理

- 忽略 `user.json`、`manifest.json`、`chat_session_index.json`
- 拒绝加密 ZIP、ZIP64、未知压缩方式、损坏文件
- 惰性读取：只解析中央目录，按需解压；限制条目数（50000）、单条解压大小（512MB）、总解压大小（2GB）
- 不执行 ZIP 内任何文件

## 错误与日志

- 错误会显示短文案和可展开详情
- 详情可能包含本地路径/文件名；分享前请先脱敏
- 不要把真实对话内容、账号信息、`.credentials.yaml` 或完整日志贴到公开 issue

## 网络审计

```bash
npm run audit
```

脚本检查插件宿主代码没有直接网络访问。摘要请求通过 DSH 的 `llm` 服务，不在插件里直接发网络请求。

## 安装信任

- 仅从本仓库或你信任的镜像安装
- 不要从来源不明的 fork/压缩包安装
- 安装后可在 DSH 插件列表核对来源与版本

## 报告安全问题

见 [SECURITY.md](../SECURITY.md)。请使用 GitHub 私下报告，不要在公开 issue 中放凭据或真实对话。
