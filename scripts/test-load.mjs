import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { writeZip } from './test-fixtures.mjs'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-load-'))
process.env.LOCALAPPDATA = path.join(dir, 'store')

const { handleRoute } = await import('../lib/routes.js')

function v3Session(id, title) {
  return {
    id,
    title,
    pinned: false,
    current_message_id: 2,
    inserted_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:02.000Z',
    messages: [
      { id: 1, parent_id: null, role: 'USER', status: 'FINISHED', inserted_at: '2026-01-01T00:00:01.000Z', fragments: [{ type: 'REQUEST', content: 'hi ' + id }] },
      { id: 2, parent_id: 1, role: 'ASSISTANT', status: 'FINISHED', inserted_at: '2026-01-01T00:00:02.000Z', fragments: [{ type: 'RESPONSE', content: 'ok' }] },
    ],
  }
}

const smallZip = writeZip(dir, 'deepseek_data-2026-01-01', {
  'manifest.json': JSON.stringify({ export_format_version: 3 }),
  'chat_sessions/a.json': JSON.stringify(v3Session('a', 'A')),
  'chat_sessions/b.json': JSON.stringify(v3Session('b', 'B')),
  'chat_sessions/c.json': JSON.stringify(v3Session('c', 'C')),
})
const largeEntries = { 'manifest.json': JSON.stringify({ export_format_version: 3 }) }
for (let index = 0; index < 200; index += 1) {
  largeEntries['chat_sessions/l' + index + '.json'] = JSON.stringify(v3Session('l' + index, 'L' + index))
}
const largeZip = writeZip(dir, 'deepseek_data-2026-01-02', largeEntries)
const v4Path = writeZip(dir, 'deepseek_data-2026-02-01', {
  'manifest.json': JSON.stringify({ export_format_version: 4 }),
  'chat_sessions/a.json': JSON.stringify(v3Session('a', 'A')),
})

const server = http.createServer((req, res) => {
  handleRoute({}, req, res).catch((error) => {
    res.writeHead(500, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: false, message: String(error) }))
  })
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const port = server.address().port

async function call(method, params) {
  const response = await fetch('http://127.0.0.1:' + port + '/', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ method, params }),
  })
  return response.json()
}

async function waitJob(job) {
  const deadline = Date.now() + 10_000
  while (job.status === 'running' && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50))
    job = (await call('loadStatus', {})).job
  }
  return job
}

// One read at a time: the second start of a long parse must be refused.
const parallel = await Promise.all([
  call('loadStart', { paths: [largeZip] }),
  call('loadStart', { paths: [largeZip] }),
])
const accepted = parallel.filter((result) => result.ok === true)
const refused = parallel.filter((result) => result.ok !== true)
assert.equal(accepted.length, 1)
assert.equal(refused.length, 1)
assert.match(refused[0].message, /已有读取在进行/)
const largeJob = await waitJob(accepted[0].job)
assert.equal(largeJob.status, 'done')
assert.equal(largeJob.payload.conversations.length, 200)
assert.equal(largeJob.done, largeJob.total)

// Small archive: the start response is pending, then the polled result.
const started = await call('loadStart', { paths: [smallZip] })
assert.equal(started.ok, true)
assert.equal(started.job.status, 'running')
let job = await waitJob(started.job)
assert.equal(job.status, 'done')
assert.equal(job.done, job.total)
assert.equal(job.payload.conversations.length, 3)
assert.equal(job.payload.formats[0].id, 'official/v3')
assert.equal(job.payload.duplicateConversations, 0)

const missing = await call('loadStart', { paths: [path.join(dir, 'missing.json')] })
const missingJob = await waitJob(missing.job)
assert.equal(missingJob.status, 'failed')
assert.match(missingJob.error, /文件不存在/)

const unsupported = await call('loadStart', { paths: [v4Path] })
const unsupportedJob = await waitJob(unsupported.job)
assert.equal(unsupportedJob.status, 'failed')
assert.match(unsupportedJob.error, /官方导出 v4 暂不支持/)

server.close()
console.log('PASS async load progress, concurrency guard, missing file and unsupported version')
