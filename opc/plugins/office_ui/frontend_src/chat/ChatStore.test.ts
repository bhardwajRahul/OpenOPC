import assert from 'node:assert/strict'

import type { ChatMessage } from '../types/chat'
import { mapBackendMessage } from '../lib/collabSync'
import { analyzeCheckpointMessages } from './checkpointUtils'
import { __chatStoreTestUtils } from './ChatStore'

const persistentTimestamps = __chatStoreTestUtils.latestPersistentMessageTimestamps([
  {
    id: 'db-assistant-1',
    channelId: 'session:read-test',
    sender: 'assistant',
    senderName: 'OPC',
    content: 'First persisted reply',
    timestamp: 10,
    mentions: [],
  },
  {
    id: 'msg-local-only',
    channelId: 'session:read-test',
    sender: 'user',
    senderName: 'You',
    content: 'Optimistic message',
    timestamp: 30,
    mentions: [],
    metadata: { ui_message_id: 'ui-local-only' },
  },
  {
    id: 'db-assistant-2',
    channelId: 'session:read-test',
    sender: 'assistant',
    senderName: 'OPC',
    content: 'Latest persisted reply',
    timestamp: 20,
    mentions: [],
  },
])

assert.equal(persistentTimestamps['session:read-test'], 20)

const unreadState = { 'session:read-test': 10 }
const advancedReadState = __chatStoreTestUtils.advanceReadTimestamp(
  unreadState,
  'session:read-test',
  persistentTimestamps['session:read-test'],
)
assert.notEqual(advancedReadState, unreadState)
assert.equal(advancedReadState['session:read-test'], 20)
assert.equal(
  __chatStoreTestUtils.advanceReadTimestamp(advancedReadState, 'session:read-test', 20),
  advancedReadState,
  'marking an already-read channel must preserve state identity',
)
assert.equal(
  __chatStoreTestUtils.advanceReadTimestamp(advancedReadState, 'session:read-test', 15),
  advancedReadState,
  'an older snapshot must not move the read cursor backwards',
)

const syntheticCheckpoint: ChatMessage = {
  id: 'checkpoint::cp-delivery',
  channelId: 'session:task-1',
  sender: 'assistant',
  senderName: 'Company Member',
  content: 'Human review requested.',
  timestamp: 1,
  mentions: [],
  metadata: {
    checkpoint_type: 'company_delivery_feedback',
    checkpoint_id: 'cp-delivery',
    summary: 'Pending review',
  },
}

const backendCheckpointUpdate: ChatMessage = {
  id: 'db-message-1',
  channelId: 'session:task-1',
  sender: 'assistant',
  senderName: 'Company Member',
  content: 'Human review requested.',
  timestamp: 2,
  mentions: [],
  metadata: {
    checkpoint_type: 'company_delivery_feedback',
    checkpoint_id: 'cp-delivery',
    checkpoint_status: 'ignored',
    checkpoint_reply_kind: 'ignore',
  },
}

const mergedCheckpoint = __chatStoreTestUtils.dedupeMessages([
  syntheticCheckpoint,
  backendCheckpointUpdate,
])

assert.equal(mergedCheckpoint.length, 1)
assert.equal(mergedCheckpoint[0].id, 'db-message-1')
assert.equal(mergedCheckpoint[0].timestamp, 1, 'checkpoint status updates must keep their original timeline position')
assert.equal(mergedCheckpoint[0].metadata?.checkpoint_status, 'ignored')
assert.deepEqual([...analyzeCheckpointMessages(mergedCheckpoint).pendingMessageIds], [])
assert.deepEqual([...analyzeCheckpointMessages(mergedCheckpoint).respondedMessageIds], ['db-message-1'])

const terminalSyntheticCheckpoint: ChatMessage = {
  ...syntheticCheckpoint,
  timestamp: 2,
  metadata: {
    ...syntheticCheckpoint.metadata,
    checkpoint_status: 'ignored',
    checkpoint_reply_kind: 'ignore',
  },
}

const mergedSameIdCheckpoint = __chatStoreTestUtils.dedupeMessages([
  syntheticCheckpoint,
  terminalSyntheticCheckpoint,
])

assert.equal(mergedSameIdCheckpoint.length, 1)
assert.equal(mergedSameIdCheckpoint[0].id, 'checkpoint::cp-delivery')
assert.equal(mergedSameIdCheckpoint[0].metadata?.checkpoint_status, 'ignored')
assert.deepEqual([...analyzeCheckpointMessages(mergedSameIdCheckpoint).pendingMessageIds], [])

const optimisticUserMessage: ChatMessage = {
  id: 'msg-local',
  channelId: 'session:task-1',
  sender: 'user',
  senderName: 'You',
  content: 'New requirement',
  timestamp: 3,
  mentions: [],
  metadata: {
    ui_message_id: 'ui-1',
  },
}

const backendUserMessage: ChatMessage = {
  id: 'db-user-1',
  channelId: 'session:task-1',
  sender: 'user',
  senderName: 'You',
  content: 'New requirement',
  timestamp: 4,
  mentions: [],
  metadata: {
    ui_message_id: 'ui-1',
  },
}

const mergedUserMessage = __chatStoreTestUtils.dedupeMessages([
  optimisticUserMessage,
  backendUserMessage,
])

assert.equal(mergedUserMessage.length, 1)
assert.equal(mergedUserMessage[0].metadata?.ui_message_id, 'ui-1')
assert.equal(mergedUserMessage[0].timestamp, 4, 'backend acknowledgement must replace the optimistic client clock')

const mirroredUserMessages = __chatStoreTestUtils.dedupeMessages([
  backendUserMessage,
  { ...backendUserMessage, id: 'db-user-mirror', channelId: 'session:child-task' },
])
assert.equal(
  mirroredUserMessages.length,
  2,
  'ui_message_id mirrors in different channels must remain available to each channel projection',
)

assert.deepEqual(
  __chatStoreTestUtils.unreadMessageCounts([
    {
      id: 'msg-local-system',
      channelId: 'session:task-1',
      sender: 'system',
      senderName: 'System',
      content: 'Local task assignment notice',
      timestamp: 100,
      mentions: [],
    },
    {
      id: 'db-assistant-unread',
      channelId: 'session:task-1',
      sender: 'assistant',
      senderName: 'OPC',
      content: 'Persisted reply',
      timestamp: 90,
      mentions: [],
    },
  ], {}),
  { 'session:task-1': 1 },
  'local-only system rows must not become unread entries that markRead can never cover',
)

const nativeCompanyRawTurn: ChatMessage = {
  id: 'native-raw-1',
  channelId: 'session:task-1',
  sender: 'assistant',
  senderName: 'Task Generalist',
  content: '最终分析已经完成，结论如下。',
  timestamp: 5,
  mentions: [],
  metadata: {
    source: 'engine',
    transcript_kind: 'runtime_v2_assistant',
  },
}

const companyRoleResult: ChatMessage = {
  id: 'role-result-1',
  channelId: 'session:task-1',
  sender: 'chao',
  senderName: 'Chao',
  content: '最终分析已经完成，结论如下。',
  timestamp: 6,
  mentions: [],
  metadata: {
    source: 'engine',
    transcript_kind: 'company_role_result',
  },
}

const mergedNativeCompanyDuplicate = __chatStoreTestUtils.dedupeMessages([
  nativeCompanyRawTurn,
  companyRoleResult,
])

assert.equal(mergedNativeCompanyDuplicate.length, 1)
assert.equal(mergedNativeCompanyDuplicate[0].id, 'role-result-1')
assert.equal(mergedNativeCompanyDuplicate[0].senderName, 'Chao')
assert.equal(mergedNativeCompanyDuplicate[0].timestamp, 5, 'semantic result replacement must retain its original timeline position')
assert.equal(
  mergedNativeCompanyDuplicate[0].metadata?.ui_timeline_id,
  'message:native-raw-1',
  'semantic result replacement must retain the already-mounted row identity',
)
const repeatedNativeCompanySync = __chatStoreTestUtils.dedupeMessages([
  ...mergedNativeCompanyDuplicate,
  nativeCompanyRawTurn,
  companyRoleResult,
])
assert.equal(repeatedNativeCompanySync.length, 1)
assert.equal(repeatedNativeCompanySync[0].metadata?.ui_timeline_id, 'message:native-raw-1')
assert.equal(repeatedNativeCompanySync[0].timestamp, 5)

const mountedHighPriorityResult: ChatMessage = {
  ...companyRoleResult,
  id: 'mounted-high-result',
  timestamp: 10,
  metadata: { source: 'engine', transcript_kind: 'child_task_result' },
}
const olderLowPrioritySurface: ChatMessage = {
  ...nativeCompanyRawTurn,
  id: 'older-low-result',
  timestamp: 4,
}
const historyBackfillMerge = __chatStoreTestUtils.mergeMessagesIntoExisting(
  [mountedHighPriorityResult],
  [olderLowPrioritySurface],
)
assert.equal(historyBackfillMerge.length, 1)
assert.equal(historyBackfillMerge[0].id, 'mounted-high-result')
assert.equal(historyBackfillMerge[0].timestamp, 10, 'history backfill must not move an already-mounted result row')
assert.equal(
  historyBackfillMerge[0].metadata?.ui_timeline_id,
  'message:mounted-high-result',
  'history backfill must retain the mounted high-priority result key',
)

const mappedTaskGeneralistMessage = mapBackendMessage({
  message_id: 'legacy-task-generalist',
  channel_id: 'session:task-1',
  sender: 'task_generalist',
  sender_name: 'Task Generalist',
  content: 'Legacy native task result.',
  created_at: 10,
  metadata: {
    transcript_kind: 'runtime_v2_company_assistant',
  },
})

assert.equal(mappedTaskGeneralistMessage.senderName, 'OPC')

console.log('ChatStore.test.ts: OK (read cursors, optimistic, checkpoint, and company result identity merging)')
