import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { loadSources, validateSourceInputs } from '../lib/load.js'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-sources-'))

function official(id) {
  return {
    id,
    title: id,
    inserted_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    mapping: {
      n1: { id: 'n1', parent: null, children: ['n2'], message: { inserted_at: '2026-01-01T00:00:00Z', fragments: [{ type: 'REQUEST', content: 'hi' }] } },
      n2: { id: 'n2', parent: 'n1', children: [], message: { inserted_at: '2026-01-01T00:01:00Z', fragments: [{ type: 'RESPONSE', content: 'ok' }] } },
    },
  }
}

const a = path.join(dir, 'a.json')
const b = path.join(dir, 'b.json')
fs.writeFileSync(a, JSON.stringify(official('a')))
fs.writeFileSync(b, JSON.stringify(official('b')))
const missing = path.join(dir, 'missing.json')

const validation = validateSourceInputs([a, b, missing, a])
assert.deepEqual(validation.files.map((file) => path.basename(file)).sort(), ['a.json', 'b.json'])
assert.equal(validation.failures.length, 1)
assert.match(validation.failures[0].reason, /不存在/)

const loaded = loadSources(validation.files)
assert.equal(loaded.byId.size, 2)
assert.equal(loaded.skipped.length, 0)

const partial = loadSources([a, missing])
assert.equal(partial.byId.size, 1)
assert.equal(partial.skipped.length, 1)
assert.match(partial.skipped[0].reason, /不存在/)

const bad = path.join(dir, 'bad.json')
fs.writeFileSync(bad, '{ broken')
const broken = loadSources([bad])
assert.equal(broken.byId.size, 0)
assert.equal(broken.skipped.length, 1)

const v3 = path.join(dir, 'v3.json')
fs.writeFileSync(v3, JSON.stringify({
  id: 'v3-session',
  title: 'v3',
  current_message_id: 2,
  inserted_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:02.000Z',
  messages: [
    { id: 1, parent_id: null, role: 'USER', status: 'FINISHED', fragments: [{ type: 'REQUEST', content: 'hi' }] },
    { id: 2, parent_id: 1, role: 'ASSISTANT', status: 'FINISHED', fragments: [{ type: 'RESPONSE', content: 'ok' }] },
  ],
}))
const v3Loaded = loadSources([v3])
assert.equal(v3Loaded.byId.size, 1)
assert.equal(v3Loaded.skipped.length, 0)
assert.equal(v3Loaded.kind, 'official')
assert.equal(v3Loaded.formats.get('v3-session'), 'official/v3')
assert.deepEqual(v3Loaded.byId.get('v3-session').messages.map((message) => message.role), ['user', 'assistant'])

console.log('PASS validate files, dedupe, tolerate missing and broken files, recognize v3 sessions')
