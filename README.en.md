# DeepSeek Conversation Import for DeepSeek Harness

Import DeepSeek web chat exports into **DeepSeek Harness (DSH)** as readable, resumable sessions. Select one or many local files, pick a conversation, choose how much history to keep, and import it into a workspace.

All processing is local. The plugin does not request an account password, cookie, or API key.

[中文](README.md) · [Changelog](CHANGELOG.md) · [MIT License](LICENSE)

## Features

- **Inputs**: official ZIP / `conversations.json`, single split conversations, `{ conversations }` / `{ data }` wrappers, nested arrays, browser IndexedDB records, JSONL, mixed multi-file selections, and ZIPs containing multiple JSON files.
- **Strict detection**: only DeepSeek web conversations. ChatGPT / Claude / Gemini exports are rejected with a reason. `user.json` from the official ZIP is ignored.
- **Merge and dedupe**: identity by conversation id; newer `updated_at` wins; equal timestamps compare semantic content, then export date and conversation length; unresolved ties are marked as conflicts. Older-only conversations are kept (union) and labelled; duplicate/updated/old-only/new-only counts are shown.
- **Version selection**: the picker starts on the current version marker or the latest leaf; switching a version follows the longest continuation; a custom leaf can be reopened.
- **Compression**: keep the last N turns; discard the rest or summarize it with a configured DeepSeek model; choose brief/standard/detailed summary length, a cost cap, and a summary prompt preset (neutral by default, narrative or technical) that you can edit into a custom prompt, save as a “My preset”, or delete if it is not built in; the length/format guard is appended by the host.
- **Cost estimate**: one reference estimate before import, actual usage after, peak/off-peak pricing, cache hit/miss, and local calibration that converges over time. Custom prompt tokens are included in the estimate.
- **Sessions**: writes native DSH session logs, keeps the original title, numbers repeated imports (`Title (2)`), records summary/usage markdown, and supports stop/continue/keep-partial.
- **UI**: sidebar Import page, multi-file picker, search, recent files, auto-restore of the last selection, progress for large batches, and short errors with details.
- **Safety**: no direct network access, no credentials, no telemetry; selected files are read locally; a network audit script is included.

## Install

Requirements: DSH 0.2.x (tested on 0.2.2-rc.1), Node.js >= 22.19.

WebUI:

```bash
dsh plugin --profile web add github:greenballyjq/dsh-deepseek-import
```

Restart `dsh web` and refresh the page. The **Import** tab appears in the sidebar.

Official desktop app: add `github:greenballyjq/dsh-deepseek-import` from the in-app Plugins page and restart.

Local development:

```bash
git clone https://github.com/greenballyjq/dsh-deepseek-import.git
cd dsh-deepseek-import
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
- Missing or broken files are reported and skipped without failing the rest of the selection.
- Upload copies are protected for the current set and recent list; the rest are cleaned up later.

## Docs

- [Merge rules](docs/merge.md)
- [Cost estimation](docs/cost.md)
- [Summary prompt](docs/summary-prompt.md)
- [Version picker](docs/version-picker.md)
- [Format support](docs/formats.md)
- [Security](docs/security.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Development](docs/development.md)

## Security

No telemetry, no remote upload, no account credentials. Summary requests, when enabled, go through DSH's model service. See [SECURITY.md](SECURITY.md).

## License

MIT.
