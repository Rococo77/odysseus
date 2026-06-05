import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.setOptions({ gfm: true, breaks: true })

/** Render markdown to sanitized HTML. Sanitization runs client-side only
 *  (DOMPurify needs a DOM); the app is SPA (ssr:false) so that's always the
 *  case at render time. */
export function renderMarkdown(src: string): string {
  if (!src) return ''
  const html = marked.parse(src, { async: false }) as string
  return import.meta.client ? DOMPurify.sanitize(html) : html
}
