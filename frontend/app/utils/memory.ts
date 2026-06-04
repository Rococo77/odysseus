/** Format a Unix timestamp (seconds) as a compact local date-time. */
export function formatUnix(ts: number | null | undefined): string {
  if (!ts) return '—'
  const d = new Date(ts * 1000)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/** Tailwind classes for a category badge (border + text tint). */
export function categoryClasses(category: string): string {
  switch (category) {
    case 'identity': return 'border-accent text-accent'
    case 'preference': return 'border-green text-green'
    case 'contact': return 'border-amber text-amber'
    case 'project':
    case 'goal': return 'border-accent text-accent'
    case 'task': return 'border-red text-red'
    case 'fact':
    default: return 'border-border text-muted'
  }
}
