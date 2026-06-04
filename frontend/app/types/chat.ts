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

/** A message as rendered in the thread (richer than the persisted shape). */
export interface DisplayMessage {
  role: ChatRole
  content: string
  streaming?: boolean
  error?: boolean
  dbId?: string
  model?: string
  tools?: ToolEvent[]
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
}

/** Default chat endpoint info from GET /api/default-chat. */
export interface DefaultChat {
  endpoint_url: string
  model: string
  endpoint_id?: string
}
