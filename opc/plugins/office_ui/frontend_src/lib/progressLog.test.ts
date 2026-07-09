import assert from 'node:assert/strict'
import { appendProgressEntry } from './progressLog'

let log = appendProgressEntry([], {
  timestamp: 1,
  type: 'thinking',
  summary: 'Thinking',
  detail: '我先',
  turnId: 'rt-1:1',
  itemId: 'rt-1:1:thinking',
  seq: 1,
})

for (const [seq, detail] of [
  [2, '先联网'],
  [3, '联网抓'],
  [4, '抓取'],
] as const) {
  log = appendProgressEntry(log, {
    timestamp: seq,
    type: 'thinking',
    summary: 'Thinking',
    detail,
    turnId: 'rt-1:1',
    itemId: 'rt-1:1:thinking',
    seq,
  })
}

assert.equal(log.length, 1)
assert.equal(log[0]?.summary, '我先联网抓取')
assert.equal(log[0]?.detail, '我先联网抓取')

// Token-sized streaming fragments keep their whitespace when merged, and
// entries without detail never splice their summary label into the text.
let spacedLog = appendProgressEntry([], {
  timestamp: 100,
  type: 'thinking',
  summary: 'The user',
  detail: 'The user',
  turnId: 'rt-2:1',
  itemId: 'rt-2:1:thinking',
  seq: 1,
})
spacedLog = appendProgressEntry(spacedLog, {
  timestamp: 101,
  type: 'thinking',
  summary: 'wants to',
  detail: ' wants to',
  turnId: 'rt-2:1',
  itemId: 'rt-2:1:thinking',
  seq: 2,
})
spacedLog = appendProgressEntry(spacedLog, {
  timestamp: 102,
  type: 'thinking',
  summary: 'Thinking',
  turnId: 'rt-2:1',
  itemId: 'rt-2:1:thinking',
  seq: 3,
})
assert.equal(spacedLog.length, 1)
assert.equal(spacedLog[0]?.detail, 'The user wants to')
assert.equal(spacedLog[0]?.summary, 'The user wants to')

const unchanged = appendProgressEntry(log, {
  timestamp: 5,
  type: 'thinking',
  summary: 'Thinking',
  detail: '重复',
  turnId: 'rt-1:1',
  itemId: 'rt-1:1:thinking',
  seq: 4,
})

assert.equal(unchanged[0]?.detail, '我先联网抓取')

let toolLog = appendProgressEntry([], {
  timestamp: 10,
  type: 'tool_call',
  summary: 'web_search',
  detail: '{"query":"weather"}',
  turnId: 'rt-1:2',
  toolCallId: 'call-1',
})

toolLog = appendProgressEntry(toolLog, {
  timestamp: 11,
  type: 'tool_call',
  summary: 'web_search',
  detail: 'completed',
  turnId: 'rt-1:2',
  toolCallId: 'call-1',
})

assert.equal(toolLog.length, 1)
assert.equal(toolLog[0]?.detail, '{"query":"weather"}\ncompleted')

let permissionLog = appendProgressEntry([], {
  timestamp: 20,
  type: 'autonomy',
  summary: 'shell_exec: ask',
  turnId: 'rt-1:3',
  permissionGroupKey: 'tool:shell_exec/python:domain:example.com',
})

permissionLog = appendProgressEntry(permissionLog, {
  timestamp: 21,
  type: 'autonomy',
  summary: 'shell_exec: allow',
  turnId: 'rt-1:3',
  permissionGroupKey: 'tool:shell_exec/python:domain:example.com',
})

assert.equal(permissionLog.length, 1)
assert.equal(permissionLog[0]?.summary, 'shell_exec: allow')

// Native company assistant replies stream like thinking: same-stream deltas
// accumulate into one entry instead of replacing each other, and separate
// iterations (distinct item_id) stay separate entries.
let assistantLog = appendProgressEntry([], {
  timestamp: 30,
  type: 'assistant',
  summary: '文件已成功写入',
  detail: '文件已成功写入',
  turnId: 'rt-1:4',
  itemId: 'rt-1:4:iter:2:assistant',
  seq: 1,
})
assistantLog = appendProgressEntry(assistantLog, {
  timestamp: 31,
  type: 'assistant',
  summary: '(278 行)。',
  detail: '(278 行)。',
  turnId: 'rt-1:4',
  itemId: 'rt-1:4:iter:2:assistant',
  seq: 2,
})
assistantLog = appendProgressEntry(assistantLog, {
  timestamp: 32,
  type: 'assistant',
  summary: '采集完成报告',
  detail: '采集完成报告',
  turnId: 'rt-1:4',
  itemId: 'rt-1:4:iter:3:assistant',
  seq: 1,
})
assert.equal(assistantLog.length, 2)
assert.equal(assistantLog[0]?.detail, '文件已成功写入(278 行)。')
assert.equal(assistantLog[0]?.summary, '文件已成功写入(278 行)。')
assert.equal(assistantLog[1]?.detail, '采集完成报告')
