// Types for the chat streaming protocol (POST /api/chat_stream, SSE).
// See routes/chat_routes.py. Each SSE line is `data: <json>` ending with
// the literal `data: [DONE]`; an `event: error` line precedes an error payload.

export type ChatRole = 'user' | 'assistant' | 'system'

/** A tool invocation surfaced in agent mode. */
export interface ToolEvent {
  tool: string
  command?: string
  output?: string
  exit_code?: number
  image_url?: string
}

/** An uploaded file referenced by a message (POST /api/upload item /
 *  history metadata.attachments item). */
export interface Attachment {
  id: string
  name: string
  mime: string
  size?: number
  width?: number | null
  height?: number | null
  is_duplicate?: boolean
}

/** A selectable character preset (flattened from GET /api/presets). */
export interface Preset {
  id: string
  name: string
}

/** A document streamed by the agent (doc_stream_* / doc_update events). */
export interface StreamDoc {
  id?: string
  title?: string
  language?: string
  content: string
  saved?: boolean
}

/** A web/RAG source citation. */
export interface Source {
  url?: string
  title?: string
  snippet?: string
}

/** Live research-mode state aggregated from research_* events. */
export interface ResearchState {
  phase?: string
  round?: number
  total_sources?: number
  queries?: number
  sources?: Source[]
  findings?: Array<{ heading?: string; content?: string }>
  done?: boolean
}

/** A message as rendered in the thread (richer than the persisted shape). */
export interface DisplayMessage {
  role: ChatRole
  content: string
  streaming?: boolean
  error?: boolean
  dbId?: string
  model?: string
  tools?: ToolEvent[]
  attachments?: Attachment[]
  doc?: StreamDoc
  sources?: Source[]
  memories?: Array<{ text?: string; category?: string }>
  research?: ResearchState
}

/** Token-usage metrics emitted near the end of a stream. */
export interface ChatMetrics {
  input_tokens?: number
  output_tokens?: number
  tokens_per_second?: number
  response_time?: number
  context_percent?: number
  model?: string
}

/** Options the composer can toggle for a send. */
export interface SendOptions {
  agent?: boolean
  web?: boolean
  research?: boolean
  bash?: boolean
  presetId?: string
  attachments?: Attachment[]
}

/** Raw GET /api/presets shape: a dict of preset-id → object, plus an array
 *  of user templates under `user_templates`. */
export interface PresetsResponse {
  [key: string]: { name?: string } | Array<{ id: string; name: string }> | undefined
  user_templates?: Array<{ id: string; name: string }>
}

/** Default chat endpoint info from GET /api/default-chat. */
export interface DefaultChat {
  endpoint_url: string
  model: string
  endpoint_id?: string
}
