import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import { loadSources } from '../lib/load.js'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-merge-'))
let counter = 0
const file = (name, value) => {
  const target = path.join(dir, name)
  fs.writeFileSync(target, typeof value === 'string' ? value : JSON.stringify(value))
  return target
}
const zip = (name, entries) => {
  const localParts = []
  const centralParts = []
  let offset = 0
  const names = Object.keys(entries)
  for (const entryName of names) {
    const content = Buffer.from(entries[entryName], 'utf8')
    const compressed = zlib.deflateRawSync(content)
    const nameBuffer = Buffer.from(entryName, 'utf8')
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(8, 8)
    local.writeUInt32LE(compressed.length, 18)
    local.writeUInt32LE(content.length, 22)
    local.writeUInt16LE(nameBuffer.length, 26)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(8, 10)
    central.writeUInt32LE(compressed.length, 20)
    central.writeUInt32LE(content.length, 24)
    central.writeUInt16LE(nameBuffer.length, 28)
    central.writeUInt32LE(offset, 42)
    localParts.push(local, nameBuffer, compressed)
    centralParts.push(central, nameBuffer)
    offset += 30 + nameBuffer.length + compressed.length
  }
  const centralBuffer = Buffer.concat(centralParts)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(names.length, 8)
  eocd.writeUInt16LE(names.length, 10)
  eocd.writeUInt32LE(centralBuffer.length, 12)
  eocd.writeUInt32LE(offset, 16)
  const target = path.join(dir, name + '.zip')
  fs.writeFileSync(target, Buffer.concat([...localParts, centralBuffer, eocd]))
  return target
}
const nextName = (prefix) => prefix + '-' + (++counter) + '-' + Math.random().toString(36).slice(2, 6)

function official(id, title, options = {}) {
  const updatedAt = options.updatedAt || '2026-01-02T00:00:00Z'
  const turns = options.turns || 1
  const mapping = {}
  let parent = null
  for (let index = 0; index < turns; index += 1) {
    const requestId = 'n' + (index * 2 + 1)
    const responseId = 'n' + (index * 2 + 2)
    mapping[requestId] = {
      id: requestId,
      parent,
      children: [responseId],
      message: {
        model: 'deepseek-chat',
        inserted_at: '2026-01-01T00:00:0' + index + 'Z',
        fragments: [{ type: 'REQUEST', content: (options.user || '问题') + index }],
      },
    }
    mapping[responseId] = {
      id: responseId,
      parent: requestId,
      children: [],
      message: {
        model: 'deepseek-chat',
        inserted_at: '2026-01-01T00:01:0' + index + 'Z',
        fragments: [{ type: 'RESPONSE', content: (options.text || '回答') + index }],
      },
    }
    parent = responseId
  }
  return { id, title, inserted_at: '2026-01-01T00:00:00Z', updated_at: updatedAt, mapping }
}

function browser(id, title, options = {}) {
  const updatedAt = options.updatedAt || '2026-01-02T00:00:00Z'
  return {
    data: {
      chat_session: { id, title, inserted_at: '2026-01-01T00:00:00Z', updated_at: updatedAt },
      chat_messages: [
        { message_id: 'm1', parent_id: null, role: 'user', inserted_at: '2026-01-01T00:00:00Z', model: 'deepseek-chat', fragments: [{ type: 'REQUEST', content: 'hi' }] },
        { message_id: 'm2', parent_id: 'm1', role: 'assistant', inserted_at: '2026-01-01T00:01:00Z', model: 'deepseek-chat', fragments: [{ type: 'RESPONSE', content: options.text || 'hello' }] },
      ],
    },
    version: 1,
  }
}

const officialText = (conv) => Object.values(conv.mapping || {})
  .flatMap((node) => (node.message && node.message.fragments) || [])
  .filter((fragment) => fragment && fragment.type === 'RESPONSE')
  .map((fragment) => fragment.content)
  .join('|')
const browserText = (conv) => ((conv.data && conv.data.chat_messages) || [])
  .flatMap((message) => message.fragments || [])
  .filter((fragment) => fragment && fragment.type === 'RESPONSE')
  .map((fragment) => fragment.content)
  .join('|')
const report = (label, result) => ({
  label,
  unique: result.byId.size,
  duplicates: result.duplicates,
  updated: result.updated,
  conflicts: result.conflicts,
  oldOnly: result.oldOnly,
  newOnly: result.newOnly,
  latest: result.latestSource,
})

function check(name, fn) {
  try {
    fn()
    console.log('PASS', name)
  } catch (error) {
    console.error('FAIL', name)
    console.error(' ', error.message)
    process.exitCode = 1
  }
}

check('identical json files', () => {
  const a = file(nextName('same') + '.json', [official('same', 'S')])
  const b = file(nextName('same') + '.json', [official('same', 'S')])
  const result = loadSources([a, b])
  assert.deepEqual(report('identical', result), {
    label: 'identical', unique: 1, duplicates: 1, updated: 0, conflicts: 0, oldOnly: 0, newOnly: 0, latest: '',
  })
})

check('october vs november snapshots', () => {
  const a1 = official('a', 'A')
  const b1 = official('b', 'B', { text: 'old', updatedAt: '2026-09-01T00:00:00Z' })
  const b2 = official('b', 'B', { text: 'new', updatedAt: '2026-10-02T00:00:00Z' })
  const c1 = official('c', 'C', { text: 'oct', updatedAt: '2026-09-02T00:00:00Z' })
  const c2 = official('c', 'C', { text: 'nov', updatedAt: '2026-09-02T00:00:00Z' })
  const h1 = official('h', 'old name', { updatedAt: '2026-09-03T00:00:00Z' })
  const h2 = official('h', 'new name', { updatedAt: '2026-09-03T00:00:00Z' })
  const f = official('f', 'deleted later')
  const g = official('g', 'added later')
  const oct = zip('deepseek_data-2026-10-01', { 'conversations.json': JSON.stringify([a1, b1, c1, h1, f]) })
  const nov = zip('deepseek_data-2026-11-01', { 'conversations.json': JSON.stringify([a1, b2, c2, h2, g]) })
  const result = loadSources([oct, nov])
  assert.deepEqual(report('octnov', result), {
    label: 'octnov', unique: 6, duplicates: 4, updated: 3, conflicts: 0, oldOnly: 1, newOnly: 1, latest: 'deepseek_data-2026-11-01.zip',
  })
  assert.equal(officialText(result.byId.get('b')), 'new0')
  assert.equal(officialText(result.byId.get('c')), 'nov0')
  assert.equal(result.meta.get('h').title, 'new name')
  assert.ok(result.byId.has('f'))
  assert.ok(result.byId.has('g'))
})

check('same-date snapshots equal timestamp conflict', () => {
  const d1 = official('d', 'D', { text: 'first', updatedAt: '2026-09-04T00:00:00Z' })
  const d2 = official('d', 'D', { text: 'second', updatedAt: '2026-09-04T00:00:00Z' })
  const one = zip('deepseek_data-2026-11-01-a', { 'conversations.json': JSON.stringify([d1]) })
  const two = zip('deepseek_data-2026-11-01-b', { 'conversations.json': JSON.stringify([d2]) })
  const result = loadSources([one, two])
  assert.deepEqual(report('same-date', result), {
    label: 'same-date', unique: 1, duplicates: 1, updated: 1, conflicts: 1, oldOnly: 0, newOnly: 0, latest: 'deepseek_data-2026-11-01-a.zip、deepseek_data-2026-11-01-b.zip',
  })
  assert.equal(officialText(result.byId.get('d')), 'first0')
})

check('no date equal timestamp: longer conversation wins', () => {
  const short = file(nextName('short') + '.json', [official('m', 'M', { text: 'one' })])
  const long = file(nextName('long') + '.json', [official('m', 'M', { text: 'two', turns: 2 })])
  const result = loadSources([short, long])
  assert.equal(result.byId.size, 1)
  assert.equal(result.duplicates, 1)
  assert.equal(result.updated, 1)
  assert.equal(result.conflicts, 0)
  assert.match(officialText(result.byId.get('m')), /two0\|two1/)
})

check('no date equal timestamp equal length conflict', () => {
  const first = file(nextName('first') + '.json', [official('n', 'N', { text: 'alpha' })])
  const second = file(nextName('second') + '.json', [official('n', 'N', { text: 'beta' })])
  const result = loadSources([first, second])
  assert.equal(result.conflicts, 1)
  assert.equal(result.updated, 1)
  assert.equal(officialText(result.byId.get('n')), 'alpha0')
})

check('same path twice is one source', () => {
  const a = file(nextName('dup-path') + '.json', [official('one', 'One')])
  const result = loadSources([a, a])
  assert.equal(result.sources.length, 1)
  assert.equal(result.duplicates, 0)
  assert.equal(result.byId.size, 1)
})

check('duplicate inside one file', () => {
  const a = file(nextName('inner') + '.json', [
    official('inner', 'Old', { updatedAt: '2026-01-01T00:00:00Z' }),
    official('inner', 'New', { updatedAt: '2026-02-01T00:00:00Z' }),
  ])
  const result = loadSources([a])
  assert.equal(result.byId.size, 1)
  assert.equal(result.duplicates, 1)
  assert.equal(result.updated, 1)
  assert.equal(result.meta.get('inner').title, 'New')
})

check('official and browser same id', () => {
  const off = file(nextName('off') + '.json', [official('x', 'X', { text: 'official', updatedAt: '2026-01-01T00:00:00Z' })])
  const newer = file(nextName('newer') + '.json', [browser('x', 'X', { text: 'browser', updatedAt: '2026-01-02T00:00:00Z' })])
  const result = loadSources([off, newer])
  assert.equal(result.kind, 'cache')
  assert.equal(result.updated, 1)
  assert.equal(browserText(result.byId.get('x')), 'browser')
  const tie = file(nextName('tie') + '.json', [browser('x', 'X', { text: 'browser-tie', updatedAt: '2026-01-01T00:00:00Z' })])
  const tied = loadSources([off, tie])
  assert.equal(tied.kind, 'official')
  assert.equal(officialText(tied.byId.get('x')), 'official0')
})

check('same title different ids are both kept', () => {
  const a = file(nextName('title') + '.json', [official('t1', 'Same'), official('t2', 'Same')])
  const result = loadSources([a])
  assert.equal(result.byId.size, 2)
  assert.equal(result.duplicates, 0)
})

check('identical dated zips', () => {
  const one = zip('deepseek_data-2026-11-02', { 'conversations.json': JSON.stringify([official('z', 'Z')]) })
  const two = zip('deepseek_data-2026-11-03', { 'conversations.json': JSON.stringify([official('z', 'Z')]) })
  const result = loadSources([one, two])
  assert.equal(result.byId.size, 1)
  assert.equal(result.duplicates, 1)
  assert.equal(result.updated, 0)
  assert.equal(result.oldOnly, 0)
  assert.equal(result.newOnly, 0)
  assert.equal(result.latestSource, 'deepseek_data-2026-11-03.zip')
})

check('malformed and mixed entries', () => {
  const a = file(nextName('mixed') + '.json', [official('ok', 'OK'), { hello: 'world' }])
  const result = loadSources([a])
  assert.equal(result.byId.size, 1)
  assert.equal(result.skipped.length, 1)
  assert.equal(result.byId.has('ok'), true)
})

check('jsonl wrapper and nested arrays still load', () => {
  const a = file(nextName('jsonl') + '.jsonl', [
    JSON.stringify(official('j1', 'J1')),
    JSON.stringify(browser('j2', 'J2')),
    '{ broken',
    '',
  ].join('\n'))
  const b = file(nextName('wrapped') + '.json', { conversations: [official('w1', 'W1')] })
  const c = file(nextName('nested') + '.json', [[official('n1', 'N1')], { data: [official('n2', 'N2')] }])
  const result = loadSources([a, b, c])
  assert.equal(result.byId.size, 5)
  assert.equal(result.skipped.length, 1)
})

check('zip with user.json ignores it', () => {
  const archive = zip('deepseek_data-2026-11-04', {
    'conversations.json': JSON.stringify([official('u1', 'U1')]),
    'user.json': JSON.stringify({ user_id: 'private' }),
    'nested/more.json': JSON.stringify([official('u2', 'U2')]),
  })
  const result = loadSources([archive])
  assert.equal(result.byId.size, 2)
  assert.equal(result.skipped.length, 0)
})

check('different timestamps same content do not count as updated', () => {
  const a = file(nextName('touch-a') + '.json', [official('same-content', 'Same', { updatedAt: '2026-01-01T00:00:00Z' })])
  const b = file(nextName('touch-b') + '.json', [official('same-content', 'Same', { updatedAt: '2026-02-01T00:00:00Z' })])
  const result = loadSources([a, b])
  assert.equal(result.duplicates, 1)
  assert.equal(result.updated, 0)
})

check('october and november work in either order', () => {
  const b1 = official('b', 'B', { text: 'old', updatedAt: '2026-09-01T00:00:00Z' })
  const b2 = official('b', 'B', { text: 'new', updatedAt: '2026-10-02T00:00:00Z' })
  const f = official('f', 'deleted later')
  const g = official('g', 'added later')
  const oct = zip('deepseek_data-2026-10-01-r', { 'conversations.json': JSON.stringify([b1, f]) })
  const nov = zip('deepseek_data-2026-11-01-r', { 'conversations.json': JSON.stringify([b2, g]) })
  const result = loadSources([nov, oct])
  assert.equal(result.byId.size, 3)
  assert.equal(result.duplicates, 1)
  assert.equal(result.updated, 1)
  assert.equal(result.oldOnly, 1)
  assert.equal(result.newOnly, 1)
  assert.equal(officialText(result.byId.get('b')), 'new0')
  assert.ok(result.byId.has('f'))
  assert.equal(result.latestSource, 'deepseek_data-2026-11-01-r.zip')
})

check('same conversation with reordered keys is a duplicate, not an update', () => {
  const first = official('format', 'Format')
  const second = { mapping: first.mapping, updated_at: first.updated_at, inserted_at: first.inserted_at, title: first.title, id: first.id }
  const a = file(nextName('format-a') + '.json', [first])
  const b = file(nextName('format-b') + '.json', [second])
  const result = loadSources([a, b])
  assert.equal(result.duplicates, 1)
  assert.equal(result.updated, 0)
})

check('different accounts or unrelated ids are all kept', () => {
  const a = file(nextName('account-a') + '.json', [official('acct-a-1', 'A1'), official('acct-a-2', 'A2')])
  const b = file(nextName('account-b') + '.json', [official('acct-b-1', 'B1')])
  const result = loadSources([a, b])
  assert.equal(result.byId.size, 3)
  assert.equal(result.duplicates, 0)
})

check('three versions same timestamp count two conflicts', () => {
  const one = file(nextName('three-1') + '.json', [official('three', 'Three', { text: 'one' })])
  const two = file(nextName('three-2') + '.json', [official('three', 'Three', { text: 'two' })])
  const three = file(nextName('three-3') + '.json', [official('three', 'Three', { text: 'three' })])
  const result = loadSources([one, two, three])
  assert.equal(result.byId.size, 1)
  assert.equal(result.duplicates, 2)
  assert.equal(result.updated, 2)
  assert.equal(result.conflicts, 2)
  assert.equal(officialText(result.byId.get('three')), 'one0')
})

check('same-date zip ties fall back to the longer conversation', () => {
  const short = official('longer', 'Longer', { text: 'short' })
  const long = official('longer', 'Longer', { text: 'long', turns: 2 })
  const a = zip('deepseek_data-2026-11-05-a', { 'conversations.json': JSON.stringify([short]) })
  const b = zip('deepseek_data-2026-11-05-b', { 'conversations.json': JSON.stringify([long]) })
  const result = loadSources([a, b])
  assert.equal(result.updated, 1)
  assert.equal(result.conflicts, 0)
  assert.match(officialText(result.byId.get('longer')), /long0\|long1/)
})

check('within one file equal timestamp conflict', () => {
  const a = file(nextName('inner-conflict') + '.json', [
    official('inner-c', 'C', { text: 'first' }),
    official('inner-c', 'C', { text: 'second' }),
  ])
  const result = loadSources([a])
  assert.equal(result.duplicates, 1)
  assert.equal(result.updated, 1)
  assert.equal(result.conflicts, 1)
  assert.equal(officialText(result.byId.get('inner-c')), 'first0')
})

check('missing updated_at falls back to message times', () => {
  const a = official('no-time', 'NoTime')
  delete a.updated_at
  const b = official('no-time', 'NoTime')
  delete b.updated_at
  const first = file(nextName('no-time-a') + '.json', [a])
  const second = file(nextName('no-time-b') + '.json', [b])
  const result = loadSources([first, second])
  assert.equal(result.duplicates, 1)
  assert.equal(result.updated, 0)
  const changed = official('no-time', 'NoTime', { text: 'changed' })
  delete changed.updated_at
  const third = file(nextName('no-time-c') + '.json', [changed])
  const altered = loadSources([first, third])
  assert.equal(altered.conflicts, 1)
  assert.equal(altered.updated, 1)
})

check('mixed official and browser source has no old/new labels', () => {
  const a = file(nextName('mixed-kinds') + '.json', [official('k1', 'K1'), browser('k2', 'K2')])
  const b = file(nextName('mixed-kinds-2') + '.json', [official('k1', 'K1')])
  const result = loadSources([a, b])
  assert.equal(result.kind, 'mixed')
  assert.equal(result.oldOnly, 0)
  assert.equal(result.newOnly, 0)
  assert.equal(result.latestSource, '')
})

check('three dated snapshots with deletion and addition', () => {
  const keep = official('keep', 'Keep')
  const gone = official('gone', 'Gone')
  const later = official('later', 'Later')
  const oct = zip('deepseek_data-2026-10-01-s', { 'conversations.json': JSON.stringify([keep, gone]) })
  const nov = zip('deepseek_data-2026-11-01-s', { 'conversations.json': JSON.stringify([keep]) })
  const dec = zip('deepseek_data-2026-12-01-s', { 'conversations.json': JSON.stringify([keep, later]) })
  const result = loadSources([oct, nov, dec])
  assert.equal(result.byId.size, 3)
  assert.equal(result.duplicates, 2)
  assert.equal(result.updated, 0)
  assert.equal(result.oldOnly, 1)
  assert.equal(result.newOnly, 1)
  assert.equal(result.latestSource, 'deepseek_data-2026-12-01-s.zip')
})

check('increasing timestamps keep the newest version', () => {
  const v1 = official('inc', 'Inc', { text: 'v1', updatedAt: '2026-01-01T00:00:00Z' })
  const v2 = official('inc', 'Inc', { text: 'v2', updatedAt: '2026-02-01T00:00:00Z' })
  const v3 = official('inc', 'Inc', { text: 'v3', updatedAt: '2026-03-01T00:00:00Z' })
  const a = file(nextName('inc-1') + '.json', [v1])
  const b = file(nextName('inc-2') + '.json', [v2])
  const c = file(nextName('inc-3') + '.json', [v3])
  const result = loadSources([a, b, c])
  assert.equal(result.byId.size, 1)
  assert.equal(result.duplicates, 2)
  assert.equal(result.updated, 2)
  assert.equal(result.conflicts, 0)
  assert.equal(officialText(result.byId.get('inc')), 'v30')
})

console.log('fixtures:', dir)
