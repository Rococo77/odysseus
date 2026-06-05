// Lists the caller's configured model endpoints + their models (GET /api/models)
// for model/endpoint pickers (settings defaults, per-session model switch).
export interface ModelEndpointItem {
  endpoint_id: string
  endpoint_name: string
  url: string
  models: string[]
  offline?: boolean
}

export function useModels() {
  const { request } = useApi()
  const endpoints = useState<ModelEndpointItem[]>('model-endpoints', () => [])
  const loaded = useState<boolean>('model-endpoints-loaded', () => false)

  async function fetchEndpoints(force = false) {
    if (loaded.value && !force) return endpoints.value
    const res = await request<{ items: ModelEndpointItem[] }>('/api/models')
    endpoints.value = (res.items ?? []).filter(e => e.endpoint_id)
    loaded.value = true
    return endpoints.value
  }

  /** Flat [{endpoint_id, endpoint_name, model}] options for a <select>. */
  const modelOptions = computed(() =>
    endpoints.value.flatMap(e =>
      (e.models ?? []).map(model => ({
        endpoint_id: e.endpoint_id,
        endpoint_name: e.endpoint_name,
        model,
      })),
    ),
  )

  return { endpoints, modelOptions, fetchEndpoints }
}
