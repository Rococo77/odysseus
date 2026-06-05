// Client for the synchronous image-editing ops (routes/gallery_routes.py):
// each takes a base64 image and returns a base64 image. Persisting an edit
// replaces the gallery file in place (or uploads a copy).
export function useImageEditor() {
  const { request, mediaUrl } = useApi()

  /** Fetch a gallery image as plain base64 (no data: prefix). */
  async function toBase64(url: string): Promise<string> {
    const res = await fetch(mediaUrl(url), { credentials: 'include' })
    if (!res.ok) throw new Error(`Load failed (${res.status})`)
    const blob = await res.blob()
    return await new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result).split(',')[1] || '')
      r.onerror = () => reject(new Error('Could not read image'))
      r.readAsDataURL(blob)
    })
  }

  function b64ToBlob(b64: string, type = 'image/png'): Blob {
    const bin = atob(b64)
    const arr = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
    return new Blob([arr], { type })
  }

  async function op(path: string, body: Record<string, unknown>): Promise<string> {
    const res = await request<{ image?: string; error?: string }>(path, { method: 'POST', body })
    if (res.error) throw new Error(res.error)
    if (!res.image) throw new Error('No image returned')
    return res.image
  }

  const sharpen = (image: string, amount: number) => op('/api/image/sharpen', { image, amount })
  const removeBg = (image: string) => op('/api/image/remove-bg', { image })
  const denoise = (image: string, strength: number) => op('/api/image/denoise', { image, strength })
  const upscale = (image: string, scale: 2 | 4) => op('/api/image/upscale-local', { image, scale })
  const enhanceFace = (image: string) => op('/api/image/enhance-face', { image })
  const harmonize = (image: string, prompt: string, strength: number) => op('/api/image/harmonize', { image, prompt, strength })

  /** Replace the gallery image's file in place with the edited bytes. */
  function replaceImage(id: string, b64: string) {
    const fd = new FormData()
    fd.set('image', b64ToBlob(b64), 'edited.png')
    return request(`/api/gallery/${id}/replace`, { method: 'POST', body: fd })
  }

  /** Save the edited bytes as a new gallery image. */
  function saveAsNew(b64: string) {
    const fd = new FormData()
    fd.set('file', b64ToBlob(b64), 'edited.png')
    return request<{ ok: boolean; id?: string }>('/api/gallery/upload', { method: 'POST', body: fd })
  }

  return { toBase64, sharpen, removeBg, denoise, upscale, enhanceFace, harmonize, replaceImage, saveAsNew }
}
