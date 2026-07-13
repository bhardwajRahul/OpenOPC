import type { ChatMessage } from '../types/chat'

export function stableMessageTimelineKey(message: ChatMessage): string {
  const metadata = message.metadata ?? {}
  const checkpointId = String(metadata.checkpoint_id ?? '').trim()
  if (checkpointId) return `checkpoint:${checkpointId}`

  const uiMessageId = String(metadata.ui_message_id ?? '').trim()
  const transcriptKind = String(metadata.transcript_kind ?? metadata.kind ?? '').trim()
  const metadataRole = String((metadata as Record<string, unknown>).role ?? '').trim().toLowerCase()
  const isUserTurn = message.sender === 'user'
    || metadataRole === 'user'
    || transcriptKind === 'runtime_v2_user_turn'
    || transcriptKind === 'top_level_user_turn'
  // The optimistic and persisted user surfaces share one client identity.
  if (isUserTurn && uiMessageId) return `ui:${uiMessageId}`

  // ChatStore attaches this only when one semantic result surface replaces
  // another. It preserves the already-mounted row without entering protocol
  // or persistence data.
  const retainedTimelineId = String(metadata.ui_timeline_id ?? '').trim()
  if (retainedTimelineId) return retainedTimelineId

  const turnId = String(metadata.canonical_turn_id ?? metadata.turn_id ?? '').trim()
  if (!isUserTurn && turnId && transcriptKind === 'runtime_v2_assistant') {
    return `turn:assistant:${turnId}`
  }

  return `message:${message.id}`
}
