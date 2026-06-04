import type { DisplayMessage, SendOptions, ChatMetrics, DefaultChat, ToolEvent } from '~/types/chat'
import type { ChatMessage } from '~/types/sessions'

// Chat composable: loads history and drives the SSE stream from
// POST /api/chat_stream (see routes/chat_routes.py). Parses `data: <json>`
// lines, accumulates assistant text deltas, collects agent tool events, and
// supports aborting via POST /api/chat/stop/{id}.
export function useChat() {
  const { request } = useApi()
  const { public: { apiBase } } = useRuntimeConfig()

  const messages = useState<DisplayMessage[]>('chat-messages', () => [])
  const sessionId = useState<string | null>('chat-session', () => null)
  const streaming = useState<boolean>('chat-streaming', () => false)
  const error = useState<string | null>('chat-error', () => null)
  const metrics = useState<ChatMetrics | null>('chat-metrics', () => null)

  let controller: AbortController | null = null

  async function loadHistory(id: string) {
    sessionId.value = id
    error.value = null
    metrics.value = null
    const res = await request<{ history: ChatMessage[] }>(`/api/history/${id}`)
    messages.value = (res.history ?? []).map(m => ({
      role: m.role,
      content: m.content,
      dbId: m.metadata?._db_id,
      tools: (m.metadata?.tool_events as ToolEvent[] | undefined) ?? undefined,
    }))
  }

  /** Create a fresh session from the server's default chat endpoint. */
  async function newSession(): Promise<string> {
    const dc = await request<DefaultChat>('/api/default-chat')
    const fd = new FormData()
    fd.set('name', '')
    fd.set('endpoint_url', dc.endpoint_url)
    fd.set('model', dc.model)
    if (dc.endpoint_id) fd.set('endpoint_id', dc.endpoint_id)
    const s = await request<{ id: string }>('/api/session', { method: 'POST', body: fd })
    sessionId.value = s.id
    messages.value = []
    return s.id
  }

  async function send(text: string, opts: SendOptions = {}) {
    const id = sessionId.value
    const body = text.trim()
    if (!id || !body || streaming.value) return

    messages.value.push({ role: 'user', content: body })
    const assistant = reactive<DisplayMessage>({ role: 'assistant', content: '', streaming: true })
    messages.value.push(assistant)

    const fd = new FormData()
    fd.set('message', body)
    fd.set('session', id)
    fd.set('mode', opts.agent ? 'agent' : 'chat')
    if (opts.web) fd.set(opts.agent ? 'allow_web_search' : 'use_web', 'true')
    if (opts.research) { fd.set('use_research', 'true'); fd.set('mode', 'chat') }
    if (opts.bash) fd.set('allow_bash', 'true')

    controller = new AbortController()
    streaming.value = true
    error.value = null
    metrics.value = null

    try {
      const res = await fetch(`${apiBase}/api/chat_stream`, {
        method: 'POST',
        body: fd,
        credentials: 'include',
        headers: { 'X-TZ-Offset': String(-new Date().getTimezoneOffset()) },
        signal: controller.signal,
      })
      if (!res.ok || !res.body) throw new Error(`Stream failed (${res.status})`)
      await parseStream(res.body, assistant)
    } catch (e: unknown) {
      if ((e as Error)?.name !== 'AbortError') {
        assistant.error = true
        error.value = e instanceof Error ? e.message : 'Stream error'
      }
    } finally {
      assistant.streaming = false
      streaming.value = false
      controller = null
    }
  }

  async function parseStream(stream: ReadableStream<Uint8Array>, assistant: DisplayMessage) {
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let nextIsError = false

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          nextIsError = line.slice(7).trim() === 'error'
          continue
        }
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6)
        if (data === '[DONE]') return
        let json: Record<string, unknown>
        try { json = JSON.parse(data) } catch { continue }

        if (nextIsError) {
          assistant.error = true
          assistant.content += String(json.error ?? json.detail ?? 'Error')
          nextIsError = false
          continue
        }
        handleEvent(json, assistant)
      }
    }
  }

  function handleEvent(json: Record<string, unknown>, assistant: DisplayMessage) {
    if (typeof json.delta === 'string') {
      if (!json.thinking) assistant.content += json.delta // skip reasoning tokens
      return
    }
    switch (json.type) {
      case 'model_info':
        assistant.model = json.model as string
        break
      case 'tool_start':
        (assistant.tools ??= []).push({
          tool: json.tool as string,
          command: json.command as string | undefined,
        })
        break
      case 'tool_output': {
        const t = assistant.tools?.[assistant.tools.length - 1]
        if (t) {
          t.output = json.output as string | undefined
          t.exit_code = json.exit_code as number | undefined
          t.image_url = json.image_url as string | undefined
        }
        break
      }
      case 'agent_step':
        if (assistant.content && !assistant.content.endsWith('\n\n')) assistant.content += '\n\n'
        break
      case 'message_saved':
        assistant.dbId = json.id as string
        break
      case 'metrics':
        metrics.value = json.data as ChatMetrics
        break
    }
  }

  async function stop() {
    controller?.abort()
    if (sessionId.value) {
      try { await request(`/api/chat/stop/${sessionId.value}`, { method: 'POST' }) } catch { /* best-effort */ }
    }
  }

  return { messages, sessionId, streaming, error, metrics, loadHistory, newSession, send, stop }
}
