# DeepSeek Chat History Import for DeepSeek Harness

Import DeepSeek web chat history into **DeepSeek Harness (DSH)** as readable, resumable sessions. Select one or many local files, pick a conversation, choose how much history to keep, and import it into a workspace. Images and files from the current official export are imported too.

All processing is local. The plugin does not request an account password, cookie, or API key.

[中文](README.md) · [Changelog](CHANGELOG.md) · [MIT License](LICENSE)

## Features

- **Inputs**: official export v3 (`manifest.json` + `chat_sessions/<id>.json` + attachments), a single extracted session file, the legacy `conversations.json` (mapping tree), split conversations, `{ conversations }` / `{ records }` / `{ data }` wrappers, nested arrays, browser IndexedDB records, JSONL (one object per line), multi-file selections, and ZIPs containing any of these.
- **Strict detection**: only DeepSeek web conversations. The export format is identified by `export_format_version` when present, otherwise by structure. Unknown versions are rejected explicitly. ChatGPT / Claude / Gemini exports are rejected with a reason. `user.json`, `manifest.json` and `chat_session_index.json` are ignored.
- **Merge and dedupe**: identity by conversation id; chats are compared by role, times and text (ignoring format fields, message ids and citation markers). Identical chats keep the first copy and are not counted as updates; a newer title is adopted separately. Different chats prefer newer `updated_at`, then official over browser, then export date, then message count; unresolved ties keep the first copy. Older-only conversations are kept (union).
- **Attachments**: v3 images become image blocks in the imported session, other files become file blocks; missing or oversized attachments are skipped with a note. Legacy and browser exports only keep attachment names.
- **Status notes**: replies marked `INCOMPLETE`, `TIMEOUT` or `CONTEXT_LENGTH_EXCEEDED` get a visible note; `CONTENT_FILTER` keeps the export's fallback text.
- **Version selection**: the picker starts on the current version marker or the latest leaf; switching a version follows the longest continuation; a custom leaf can be reopened.
- **Compression**: keep the last N turns and choose what happens to older ones: **drop**, **summarize** with a configured DeepSeek model, or **full archive** to `deepseek-memory/memory.md` without a model call. Summaries support a per-import reasoning effort (`Off / Low / High / Max`, default from the plugin config `Off`), summary length, a cost cap, and an editable prompt preset. Full archive can optionally save AI thinking to `thinking.md`.
- **Cost estimate**: one reference estimate before import, actual usage after, peak/off-peak pricing, cache hit/miss, and local calibration that converges over time. Drop and full-archive imports make no model calls. Reasoning tokens of a non-`Off` summary are not part of the estimate; the panel says so explicitly.
- **Sessions and memory files**: writes native DSH session logs, keeps the original title, numbers repeated imports (`Title (2)`), and for summary/full-archive imports writes the unified `deepseek-memory/` directory (`manifest.json`, `memory.md`, optional `thinking.md`, split parts for large files). Drop imports write no memory files. Supports stop/continue/keep-partial.
- **UI**: sidebar Import page, multi-file picker, search, recent files, auto-restore of the last selection, a dedicated parse progress bar with a percentage, format labels (`official v3` / `official (no version)` / `browser record` / `mixed`), and short errors with details.
- **Safety**: no direct network access, no credentials, no telemetry; selected files are read locally; attachments are written to the local DSH attachment store; a network audit script is included.

## Install

Requirements: DSH 0.2.x (tested on 0.2.2-rc.1), Node.js >= 22.19.

WebUI:

```bash
dsh plugin --profile web add github:greenballyjq/dsh-deepseek-chat-history-import
```

Restart `dsh web` and refresh the page. The **Import** tab appears in the sidebar.

Official desktop app: add `github:greenballyjq/dsh-deepseek-chat-history-import` from the in-app Plugins page and restart.

Local development:

```bash
git clone https://github.com/greenballyjq/dsh-deepseek-chat-history-import.git
cd dsh-deepseek-chat-history-import
dsh plugin --profile web add link:.
npm run build:client
```

## Usage

1. Open **Import**.
2. Select one or more JSON / JSONL / ZIP files.
3. Search and select a conversation.
4. Choose version, retained turns, compression, and cost cap.
5. Import, then open the new workspace and continue with any model.

## Limits

- Up to 5000 files / 2GB per selection in the panel and 10000 files / 5GB on the host.
- Per-file upload limit: 512MB.
- One ZIP: up to 50000 entries, 512MB per entry, 2GB total uncompressed.
- One imported attachment: 64MB; larger attachments are skipped with a note.
- Missing or broken files are reported and skipped without failing the rest of the selection.
- Upload copies are protected for the current set and recent list; the rest are cleaned up later.
- A single huge JSON file has no intra-file progress (`JSON.parse` cannot be interrupted); ZIP entries do report progress.

## Docs

- [Merge rules](docs/merge.md)
- [Cost estimation](docs/cost.md)
- [Summary prompt](docs/summary-prompt.md)
- [Version picker](docs/version-picker.md)
- [Format support](docs/formats.md)
- [Memory files](docs/memory.md)
- [Official export format comparison (Chinese)](docs/官方导出格式对照.md)
- [Security](docs/security.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Development](docs/development.md)

## Security

No telemetry, no remote upload, no account credentials. Summary requests, when enabled, go through DSH's model service. Attachments are read from the selected export and stored locally. See [SECURITY.md](SECURITY.md).

## License

MIT.
