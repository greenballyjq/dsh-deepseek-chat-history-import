/**
 * Audit the plugin for outbound network and child-process calls.
 *
 * The plugin's data contract: a picked export file is read locally, an imported
 * session is written through DSH's session persistence, and the only outbound
 * data is the summary prompt sent through DSH's `llm` service. Any direct
 * network, DNS, raw socket, or child-process call would be a way to ship the
 * whole export elsewhere, so this script fails on their presence.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Import specifiers that grant a direct network or process channel. */
const FORBIDDEN_IMPORTS = [
  'node:http', 'node:https', 'node:net', 'node:tls', 'node:dns', 'node:http2',
  'node:child_process', 'node:cluster', 'node:dgram', 'node:worker_threads',
  'http', 'https', 'net', 'tls', 'dns', 'http2', 'child_process', 'dgram',
  'axios', 'node-fetch', 'undici', 'got', 'request',
]

/** Dynamic forms that bypass the import check. */
const FORBIDDEN_CALLS = [
  ['eval(', 'eval'],
  ['new Function', 'new Function'],
]

/** Absolute remote URLs must never appear in source. Relative paths are local API calls. */
const REMOTE_URL = /(['"`])https?:\/\/[^'"`\s]+/g

let failures = 0

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8')
}

function fail(file, line, message) {
  failures += 1
  console.log(file + ':' + line + '  ' + message)
}

const scanned = ['index.js', 'client.js',
  ...fs.readdirSync(path.join(root, 'lib')).filter((name) => name.endsWith('.js')).map((name) => 'lib/' + name),
  ...(fs.existsSync(path.join(root, 'client', 'src'))
    ? fs.readdirSync(path.join(root, 'client', 'src')).filter((name) => name.endsWith('.js')).map((name) => 'client/src/' + name)
    : []),
]

for (const file of scanned) {
  const lines = read(file).split('\n')
  lines.forEach((line, index) => {
    const lineNo = index + 1
    const trimmed = line.trim()
    if (trimmed.startsWith('*') || trimmed.startsWith('//')) return
    for (const specifier of FORBIDDEN_IMPORTS) {
      const pattern = new RegExp("(from|import|require)\\s*\\(?\\s*['\"]" + specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "['\"]")
      if (pattern.test(line)) fail(file, lineNo, "imports '" + specifier + "'")
    }
    for (const [needle, label] of FORBIDDEN_CALLS) {
      if (line.includes(needle)) fail(file, lineNo, 'uses ' + label)
    }
    for (const match of line.matchAll(REMOTE_URL)) {
      fail(file, lineNo, 'hardcodes remote URL ' + match[1] + '…')
    }
  })
}

// Both halves must agree on the two local routes; a rename on one side would
// silently break the panel.
const hostSource = ['index.js', ...fs.readdirSync(path.join(root, 'lib')).map((name) => 'lib/' + name)]
  .filter((file) => file === 'index.js' || file.endsWith('.js'))
  .map((file) => read(file))
  .join('\n')
const clientSource = read('client.js')
for (const route of ['/deepseek-chat-history-import/api', '/deepseek-chat-history-import/upload']) {
  if (!hostSource.includes(route)) fail('index.js', 0, 'missing route ' + route)
  if (!clientSource.includes(route)) fail('client.js', 0, 'missing route ' + route)
}

if (failures > 0) {
  console.log('')
  console.log('audit failed: ' + failures + ' disallowed network/process call(s)')
  process.exit(1)
}
console.log('audit passed: no direct network or child-process calls')
