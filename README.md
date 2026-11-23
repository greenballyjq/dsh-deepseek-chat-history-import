# DeepSeek 对话导入（DSH 插件）

把 DeepSeek 网页端导出的对话历史导入 **DeepSeek Harness（DSH）**：在侧栏「导入」里选择文件，挑选对话，设置保留轮数与压缩方式，导入成可阅读、可继续聊的 DSH 会话。

支持官方 ZIP / 拆分出来的单个对话 / 浏览器 IndexedDB 导出 / JSONL，也可以一次选择多个文件混合导入。所有处理都在本机完成。

[English](README.en.md) · [更新日志](CHANGELOG.md) · [MIT License](LICENSE)

![banner](docs/banner.svg)

## 功能总览

### 1. 输入格式

- **官方导出**：`deepseek_data-<日期>.zip`，以及解压后的 `conversations.json`
- **官方整包**：裸数组、`{ conversations: [...] }`、`{ data: [...] }`
- **官方拆分**：单个对话对象、数组套数组
- **浏览器 IndexedDB 导出**：单条记录、裸记录、数组、`{ records: [...] }`、`{ data: [...] }`
- **JSONL**：一行一个对话对象或记录，允许坏行
- **ZIP**：官方整包、拆分文件打包、zip 内多个 json/jsonl
- **多文件混合**：JSON / JSONL / ZIP 可以一起选
- 官方 zip 里的 `user.json` 会被忽略，不读取、不导入

### 2. 严格识别，拒绝其它 AI

- 官方对话必须同时满足：有 `mapping`，节点 `message.fragments` 里出现 `REQUEST` / `RESPONSE` / `THINK`，并且有对话 `id`
- 浏览器记录必须同时满足：`chat_session.id` 与 `chat_messages` 数组
- ChatGPT / Claude / Gemini 等导出会被拒绝并说明原因，不会误导入
- 缺 `id`、空文件、损坏 JSON 会跳过并计数，不会静默吞掉

### 3. 多文件合并与去重

- **身份只看对话 id**，标题相同不算同一段
- 同 id 取 `updated_at` 较新的一份
- 时间相同比较语义内容（忽略 JSON 键顺序与格式）；内容不同时依次按导出日期、对话长度取舍
- 仍分不出时标记「冲突」，保留第一份
- 不同 id 全部保留；只在一个文件出现的对话也保留（并集）
- 面板显示：唯一对话数、重复数、其中更新数、旧版独有、新版独有、冲突、跳过及原因
- 两个完全相同的文件不会重复显示；批量导入不会中途删除已上传文件

详细规则见 [docs/merge.md](docs/merge.md)。

### 4. 版本 / 分支选择

- 默认路径：有导出标记的当前消息优先，否则停在**最新版**（时间最晚的叶子）
- 切换版本后：沿该版本往后走**内容最多的后续**
- 支持「消息最多的版本」「逐条选择版本」；已选过版本可「重选」
- 不拼接两个版本的消息，整段取一份

详见 [docs/version-picker.md](docs/version-picker.md)。

### 5. 导入设置

- **保留最近 N 轮**，超出部分选择丢弃或压缩
- **压缩方式**：
  - 占位：不调用模型，只保留占位摘要
  - 摘要：调用你配置的 DeepSeek 模型生成摘要
- **摘要长度**：简短 / 标准 / 详细
- **摘要提示词**：中性（默认）/ 叙事 / 技术；选中后显示原文，可直接编辑，编辑自动切换为「自定义」；字数和格式约束由系统自动追加（[规则](docs/summary-prompt.md)）
- **费用上限**：估算超过上限时阻止导入
- **导入位置**、**摘要模型**、**默认值**都可在插件配置里修改

### 6. 费用预估与校准

- 导入前给出**一个**参考费用，不再同时显示上下限或运行中投影
- 导入结束后显示实际费用与用量（未命中 / 缓存命中 / 输出）
- 按模型版本、峰谷时段、输入/输出 token、缓存命中/未命中计价
- 学习参数（输入系数、输出系数、同计划命中率等）保存在本机校准文件；校准后会逐步贴近实际
- 旧工作区记录可作为同计划参考，避免重复导入时仍按冷启动估价

详见 [docs/cost.md](docs/cost.md)。

### 7. 写入 DSH 会话

- 每段对话写入 DSH 原生会话日志，不修改 DSH 源码
- 会话标题优先使用原对话标题；重复导入自动编号为 `标题 (2)`、`标题 (3)`…
- 可选生成摘要 / 记录 md，包含保留轮数、摘要长度、实际用量
- 支持「停止导入」：继续、保留已完成部分并停止、停止并丢弃
- 写入前做会话格式自检；失败时给出短文案 + 详情

### 8. 面板

- 侧栏「导入」页面：文件选择（多选）、最近文件、对话搜索
- 状态行显示格式、文件数、对话数、重复/跳过等
- 导入设置与费用预估在同一页
- 右上角「插件配置」；打开面板自动恢复上次选择的文件集合
- 大批量上传显示 `读取中 123/2019` 进度

### 9. 安全与本地优先

- 插件本身不直接访问网络；选择摘要压缩时，摘要请求通过 DSH 的模型服务发出
- 不需要账号密码、Cookie 或 API Key
- 无遥测、无远程日志
- 只读取你选择的本地文件；只写入 DSH 会话、工作区与插件数据目录
- 提供网络审计脚本：`npm run audit`

详见 [docs/security.md](docs/security.md)。

## 安装

### 环境

- DeepSeek Harness 0.2.x（已在 0.2.2-rc.1 验证）
- Node.js >= 22.19

### WebUI（`dsh web`）

```bash
dsh plugin --profile web add github:greenballyjq/dsh-deepseek-import
```

安装后重启 `dsh web`，刷新页面，侧栏出现「导入」。

### 官方桌面端

在桌面应用的「插件」页添加：

```text
github:greenballyjq/dsh-deepseek-import
```

按提示重启。桌面端使用自己的 `desktop` profile，不要用 `--profile web` 安装到错误位置。

### 本地开发安装

```bash
git clone https://github.com/greenballyjq/dsh-deepseek-import.git
cd dsh-deepseek-import
dsh plugin --profile web add link:.
```

修改 `client.js` 前先运行 `npm run build:client`；前端改完刷新页面，宿主侧改动重启 `dsh web`。

## 快速开始

1. 打开侧栏「导入」。
2. 点「选择文件」，选官方 zip / conversations.json / 拆分 json / 浏览器导出 / JSONL；可以多选。
3. 在对话列表里搜索并选中一段。
4. 选择版本、保留轮数、压缩方式与费用上限。
5. 点「导入」，完成后在左侧工作区打开新会话，选模型继续聊。

## 支持的导出文件

| 来源 | 形态 | 支持 |
|---|---|---|
| 官方导出 | `deepseek_data-<日期>.zip` | ✅ |
| 官方导出 | `conversations.json` 裸数组 | ✅ |
| 官方拆分 | 单个对话对象 / 数组套数组 | ✅ |
| 官方变体 | `{ conversations: [...] }` / `{ data: [...] }` | ✅ |
| 浏览器 | 单条 / 裸记录 / 数组 / `{ records }` / `{ data }` | ✅ |
| JSONL | 一行一个对象或记录 | ✅ |
| ZIP | 官方整包 / 拆分文件 / 多 json / 子目录 | ✅ |
| 混合 | 多文件、JSON/JSONL/ZIP 混选 | ✅ |
| 其它 AI | ChatGPT / Claude / Gemini 等 | ❌ 拒绝并说明原因 |

## 批量与限制

- 一次最多 **5000 个文件 / 2GB**（面板校验）；宿主侧另有 10000 个文件 / 5GB 上限
- 单个上传最大 512MB
- 上传副本在批量上传过程中不会被清理；当前集合与 24 小时内文件受保护
- 缺失 / 损坏文件跳过并报告，不影响同批其它文件
- 超过限制会在上传前给出明确提示

## 常见问题

**选了 10 个以上文件，加载时报文件不存在？**  
已在 2.12.0 修复：上传过程中不再清理副本。请更新到最新版本。

**一次选 2019 个文件可以吗？**  
可以。客户端上限 5000 个 / 2GB；实测 2019 个文件、166MB 可上传并加载。

**为什么两个相同的 zip 只有一份对话？**  
同一对话按 id 合并；面板会显示「重复 N 项」。不是漏读，是去重。

**ChatGPT 导出被拒绝？**  
这是预期行为。本插件只认 DeepSeek 网页对话，避免误导入其它 AI 的内容。

**旧文件里被删除的对话为什么还在？**  
默认取并集，并标记「旧版独有」。导出没有删除记录，保留比静默丢弃更安全；只想要当前状态就只选最新那份。

**预估和实际差很多？**  
预估是启发式；校准会逐步贴近实际。若差距持续很大，见 [docs/cost.md](docs/cost.md) 的参数与校准说明。

**摘要调用失败/超过费用上限？**  
检查摘要模型配置与费用上限；也可以改用「占位」压缩，不调用模型。

**导入了一半可以停吗？**  
可以。弹窗里选择继续、保留已完成部分并停止、停止并丢弃。

更多见 [docs/troubleshooting.md](docs/troubleshooting.md)。

## 开发

```text
index.js              宿主入口
client.js             构建后的前端（由 client/src 生成）
client/src/           前端源码片段
lib/                  解析、合并、规划、会话写入、路由
data/profile.json     模型、价格、摘要与校准默认值
scripts/              构建、测试、网络审计
```

```bash
npm test               # 合并 / 版本路径 / 文件校验
npm run audit          # 确认没有直接网络访问
npm run build:client   # 从 client/src 生成 client.js
```

测试覆盖：

- `test-merge.mjs`：24 项合并 / 去重 / 冲突 / 官方与浏览器混合
- `test-path.mjs`：9 项初始最新、切换最长、重选
- `test-sources.mjs`：文件校验、缺失、损坏、去重

测试命令见上；如需 CI，可自行接入。

## 安全

- 不收集遥测，不上传对话
- 不接收账号密码 / Cookie / API Key
- `user.json` 与无关文件不导入
- 见 [SECURITY.md](SECURITY.md) 与 [docs/security.md](docs/security.md)

## 变更

见 [CHANGELOG.md](CHANGELOG.md)。

## 参与

见 [CONTRIBUTING.md](CONTRIBUTING.md)。请勿在 issue 中粘贴真实对话、账号信息或本地路径。

## 许可

MIT。见 [LICENSE](LICENSE)。
