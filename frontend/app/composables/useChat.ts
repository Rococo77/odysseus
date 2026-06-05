import type { DisplayMessage, SendOptions, ChatMetrics, DefaultChat, ToolEvent, Attachment, Preset, PresetsResponse, Source, ResearchState } from '~/types/chat'
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
  const presets = useState<Preset[]>('chat-presets', () => [])

  let controller: AbortController | null = null

  /** Flatten GET /api/presets (dict + user_templates) into a picker list. */
  async function fetchPresets() {
    try {
      const res = await request<PresetsResponse>('/api/presets')
      const list: Preset[] = []
      for (const [key, val] of Object.entries(res)) {
        if (key === 'user_templates' || !val || Array.isArray(val)) continue
        list.push({ id: key, name: val.name || key })
      }
      for (const t of res.user_templates ?? []) list.push({ id: t.id, name: t.name })
      presets.value = list
    } catch { /* presets are optional */ }
  }

  /** Upload files for use as chat attachments (POST /api/upload). */
  async function uploadFiles(files: FileList | File[]): Promise<Attachment[]> {
    const fd = new FormData()
    for (const f of Array.from(files)) fd.append('files', f, f.name)
    const res = await request<{ files: Attachment[] }>('/api/upload', { method: 'POST', body: fd })
    return res.files ?? []
  }

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
      attachments: (m.metadata?.attachments as Attachment[] | undefined) ?? undefined,
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

    messages.value.push({ role: 'user', content: body, attachments: opts.attachments?.length ? opts.attachments : undefined })
    const assistant = reactive<DisplayMessage>({ role: 'assistant', content: '', streaming: true })
    messages.value.push(assistant)

    const fd = new FormData()
    fd.set('message', body)
    fd.set('session', id)
    fd.set('mode', opts.agent ? 'agent' : 'chat')
    if (opts.web) fd.set(opts.agent ? 'allow_web_search' : 'use_web', 'true')
    if (opts.research) { fd.set('use_research', 'true'); fd.set('mode', 'chat') }
    if (opts.bash) fd.set('allow_bash', 'true')
    if (opts.presetId) fd.set('preset_id', opts.presetId)
    if (opts.attachments?.length) fd.set('attachments', JSON.stringify(opts.attachments.map(a => a.id)))

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

      // --- Document streaming ---
      case 'doc_stream_open':
        assistant.doc = { title: json.title as string, language: json.language as string, content: '' }
        break
      case 'doc_stream_delta':
        assistant.doc ??= { content: '' }
        assistant.doc.content += (json.content as string) ?? ''
        break
      case 'doc_update':
        assistant.doc = {
          ...(assistant.doc ?? { content: '' }),
          id: json.id as string,
          title: (json.title as string) ?? assistant.doc?.title,
          language: (json.language as string) ?? assistant.doc?.language,
          saved: json.saved as boolean,
        }
        break

      // --- Sources / memory ---
      case 'web_sources':
      case 'rag_sources':
        (assistant.sources ??= []).push(...((json.data as Source[]) ?? []))
        break
      case 'memories_used':
        assistant.memories = json.data as Array<{ text?: string; category?: string }>
        break

      // --- Research mode ---
      case 'research_progress':
        assistant.research = { ...assistant.research, ...(json.data as ResearchState) }
        break
      case 'research_sources':
        assistant.research = { ...assistant.research, sources: json.data as Source[] }
        break
      case 'research_findings':
        assistant.research = { ...assistant.research, findings: json.data as ResearchState['findings'] }
        break
      case 'research_done':
        assistant.research = { ...assistant.research, done: true }
        break
    }
  }

  /** Delete a message (and, when deleting a user turn, its immediate reply). */
  async function deleteMessage(msg: DisplayMessage) {
    const id = sessionId.value
    if (!id || !msg.dbId) return
    const ids = [msg.dbId]
    const i = messages.value.indexOf(msg)
    if (msg.role === 'user') {
      const next = messages.value[i + 1]
      if (next?.role === 'assistant' && next.dbId) ids.push(next.dbId)
    }
    await request(`/api/session/${id}/delete-messages`, { method: 'POST', body: { msg_ids: ids } })
    messages.value = messages.value.filter(m => !m.dbId || !ids.includes(m.dbId))
  }

  /** Edit a message's content in place (no re-run). */
  async function editMessage(msg: DisplayMessage, content: string) {
    const id = sessionId.value
    if (!id || !msg.dbId) return
    await request(`/api/session/${id}/edit-message`, { method: 'POST', body: { msg_id: msg.dbId, content } })
    msg.content = content
  }

  /** Regenerate the reply to the user turn preceding `assistant`: truncate the
   *  history back to that user message, then re-send it. */
  async function regenerate(assistant: DisplayMessage) {
    const id = sessionId.value
    if (!id || streaming.value) return
    const i = messages.value.indexOf(assistant)
    if (i < 0) return
    let j = -1
    for (let k = i - 1; k >= 0; k--) {
      if (messages.value[k]!.role === 'user') { j = k; break }
    }
    if (j < 0) return
    const user = messages.value[j]!
    const text = user.content
    const attachments = user.attachments
    await request(`/api/session/${id}/truncate`, { method: 'POST', body: { keep_count: j } })
    messages.value = messages.value.slice(0, j)
    await send(text, attachments?.length ? { attachments } : {})
  }

  async function stop() {
    controller?.abort()
    if (sessionId.value) {
      try { await request(`/api/chat/stop/${sessionId.value}`, { method: 'POST' }) } catch { /* best-effort */ }
    }
  }

  return {
    messages, sessionId, streaming, error, metrics, presets,
    loadHistory, newSession, send, stop, fetchPresets, uploadFiles,
    deleteMessage, editMessage, regenerate,
  }
}
