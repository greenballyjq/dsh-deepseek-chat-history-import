/** Unified memory files written beside an imported conversation. */
import fs from 'node:fs'
import path from 'node:path'
import {
  MEMORY_CONTENT_FILE,
  MEMORY_DIR_NAME,
  MEMORY_FORMAT_VERSION,
  MEMORY_MANIFEST_FILE,
  MEMORY_SPLIT_BYTES,
  MEMORY_SPLIT_CHARS,
  MEMORY_THINKING_FILE,
} from './constants.js'

const POSIX_SEP = '/'


export function memoryRelativePath() {
  return MEMORY_DIR_NAME + POSIX_SEP + MEMORY_CONTENT_FILE
}


/** Unified session checkpoint text for summary and full archive modes. */
export function buildMemoryNotice(input) {
  const title = input.title || '（无标题）'
  const archived = Number(input.archivedTurns) || 0
  const inline = Number(input.inlineTurns) || 0
  const topic = '对话主题：' + title + '。'
  if (input.kind === 'full') {
    return '【导入记录】较早的 ' + archived + ' 轮对话已完整存档，保留最近 ' + inline + ' 轮原文。' + topic
      + '\n完整存档：' + input.relativeMemory
  }
  if (input.partial) {
    const partial = input.partial
    return '【导入记录】这次导入在生成摘要时停止：较早的 ' + archived + ' 轮对话中，第 '
      + partial.fromTurn + '–' + partial.toTurn + ' 轮已压缩为摘要（计划 ' + partial.total + ' 段，已生成 '
      + partial.done + ' 段），第 ' + partial.droppedFrom + '–' + partial.droppedTo + ' 轮未生成摘要，已丢弃。'
      + '保留最近 ' + inline + ' 轮原文。' + topic + '\n\n以下摘要覆盖第 ' + partial.fromTurn + '–' + partial.toTurn + ' 轮：'
  }
  return '【导入记录】较早的 ' + archived + ' 轮对话已概括为摘要，保留最近 ' + inline + ' 轮原文。' + topic
}


function isoTime(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? new Date(number).toISOString() : ''
}


function attachmentList(turn) {
  const blocks = Array.isArray(turn.attachments) ? turn.attachments : []
  return blocks.map((block) => {
    const attachment = block && block.attachment ? block.attachment : {}
    return {
      kind: block.type,
      name: attachment.name || '',
      attachmentId: attachment.attachmentId || '',
      bytes: Number(attachment.bytes) || 0,
    }
  })
}


function fullSections(turns) {
  const sections = []
  for (let index = 0; index < turns.length; index += 1) {
    const turn = turns[index]
    const turnNumber = index + 1
    const time = isoTime(turn.time)
    const heading = '## 第 ' + turnNumber + ' 轮'
    const user = String(turn.user || '').trim()
    const assistant = String(turn.text || '').trim()
    const notes = Array.isArray(turn.notes) ? turn.notes : []
    const attachments = attachmentList(turn)
    const body = []
    if (user) body.push('### 用户' + (time ? ' · ' + time : ''), '', user)
    if (attachments.length > 0) {
      body.push('', attachments.map((item) => '[附件：' + (item.name || item.kind) + ']').join('  '))
    }
    if (assistant || notes.length > 0) {
      body.push('', '### 助手' + (time ? ' · ' + time : ''), '', assistant)
      if (notes.length > 0) body.push('', notes.map((note) => '> ' + note).join('\n'))
    }
    sections.push({
      fromTurn: turnNumber,
      toTurn: turnNumber,
      heading,
      text: body.join('\n'),
    })
  }
  return sections
}


function thinkingSections(turns) {
  const sections = []
  for (let index = 0; index < turns.length; index += 1) {
    const turn = turns[index]
    const think = String(turn.think || '').trim()
    if (!think) continue
    sections.push({
      fromTurn: index + 1,
      toTurn: index + 1,
      heading: '## 第 ' + (index + 1) + ' 轮' + (turn.time ? ' · ' + isoTime(turn.time) : ''),
      text: think,
    })
  }
  return sections
}


function summarySections(segments) {
  return (Array.isArray(segments) ? segments : []).map((segment) => ({
    fromTurn: Number(segment.fromTurn) || 0,
    toTurn: Number(segment.toTurn) || 0,
    heading: '## 摘要段 ' + segment.index + ' · 第 ' + segment.fromTurn + '–' + segment.toTurn + ' 轮',
    text: String(segment.text || ''),
  }))
}


function padded(value) {
  return String(value).padStart(4, '0')
}


function partName(fromTurn, toTurn) {
  return 'memory-' + padded(fromTurn) + '-' + padded(toTurn) + '.md'
}


function renderSections(title, sections) {
  return '# ' + title + '\n\n' + sections.map((section) => section.heading + '\n\n' + section.text).join('\n\n') + '\n'
}


/** Write memory.md, splitting into part files when the content is large. */
function writeContent(dir, title, sections) {
  const full = renderSections(title, sections)
  if (Buffer.byteLength(full, 'utf8') <= MEMORY_SPLIT_BYTES && full.length <= MEMORY_SPLIT_CHARS) {
    fs.writeFileSync(path.join(dir, MEMORY_CONTENT_FILE), full, 'utf8')
    return { files: [MEMORY_CONTENT_FILE], parts: [] }
  }
  const parts = []
  let current = []
  let chars = 0
  let bytes = 0
  const flush = () => {
    if (current.length === 0) return
    const from = current[0].fromTurn
    const to = current[current.length - 1].toTurn
    const name = partName(from, to)
    fs.writeFileSync(path.join(dir, name), renderSections(title, current), 'utf8')
    parts.push({ name, fromTurn: from, toTurn: to })
    current = []
    chars = 0
    bytes = 0
  }
  for (const section of sections) {
    const size = Buffer.byteLength(section.heading + '\n\n' + section.text + '\n\n', 'utf8')
    if (current.length > 0 && (chars + section.text.length > MEMORY_SPLIT_CHARS || bytes + size > MEMORY_SPLIT_BYTES)) flush()
    current.push(section)
    chars += section.text.length
    bytes += size
  }
  flush()
  const index = ['# ' + title, '', ...parts.map((part) => '- [第 ' + part.fromTurn + '–' + part.toTurn + ' 轮](' + part.name + ')')].join('\n') + '\n'
  fs.writeFileSync(path.join(dir, MEMORY_CONTENT_FILE), index, 'utf8')
  return { files: [MEMORY_CONTENT_FILE, ...parts.map((part) => part.name)], parts }
}


/**
 * Persist the unified memory directory for one compressed import.
 *
 * Attachments remain in the DSH attachment store: the image/file content
 * blocks have no workspace-path variant, so memory.md only carries attachment
 * names and the manifest marks the store as `dsh`.
 */
export function writeMemory(input) {
  const dir = path.join(input.workspaceDir, MEMORY_DIR_NAME)
  fs.mkdirSync(dir, { recursive: true })

  const archivedTurns = Array.isArray(input.turns) ? input.turns : []
  const sections = input.kind === 'full'
    ? fullSections(archivedTurns)
    : summarySections(input.summary && input.summary.segments)
  const content = writeContent(dir, input.title || '对话', sections)

  let thinking = false
  if (input.kind === 'full' && input.keepThinking) {
    const thinkSections = thinkingSections(archivedTurns)
    if (thinkSections.length > 0) {
      fs.writeFileSync(path.join(dir, MEMORY_THINKING_FILE), renderSections('AI 思考', thinkSections), 'utf8')
      thinking = true
    }
  }

  const archived = archivedTurns.length
  const inline = Math.max(0, Number(input.totalTurns) - archived)
  const manifest = {
    format: MEMORY_FORMAT_VERSION,
    kind: input.kind,
    title: input.title || '',
    source: input.sourceName || '',
    branch: { rule: (input.branch && input.branch.rule) || 'recent' },
    importedAt: new Date().toISOString(),
    turns: {
      total: Number(input.totalTurns) || archived + inline,
      archived,
    },
    memory: content.files,
    thinking,
    attachments: 'dsh',
  }
  if (input.branch && input.branch.leafId) manifest.branch.leafId = input.branch.leafId
  if (input.kind === 'summary') {
    manifest.summary = {
      chars: Number(input.summary && input.summary.chars) || 0,
      prompt: (input.summary && input.summary.prompt) || { name: '', fingerprint: '' },
      usage: (input.summary && input.summary.usage) || null,
      partial: Boolean(input.summary && input.summary.partial),
    }
  }
  fs.writeFileSync(path.join(dir, MEMORY_MANIFEST_FILE), JSON.stringify(manifest, null, 2) + '\n', 'utf8')
  return {
    dir,
    relativeDir: MEMORY_DIR_NAME,
    files: content.files,
    manifest,
  }
}
