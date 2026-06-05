// Global keyboard shortcuts. Ctrl/Cmd + 1..7 jumps between the main pages,
// matching the top-bar nav order. Ignored while modifiers conflict or when a
// browser/native combo would be more expected.
export const NAV_SHORTCUTS: Array<{ to: string; label: string }> = [
  { to: '/chat', label: 'Chat' },
  { to: '/tasks', label: 'Tasks' },
  { to: '/sessions', label: 'Sessions' },
  { to: '/memory', label: 'Memory' },
  { to: '/notes', label: 'Notes' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/calendar', label: 'Calendar' },
  { to: '/documents', label: 'Docs' },
]

export function useShortcuts() {
  const router = useRouter()

  function onKey(e: KeyboardEvent) {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return
    const n = Number(e.key)
    if (!Number.isInteger(n) || n < 1 || n > NAV_SHORTCUTS.length) return
    e.preventDefault()
    router.push(NAV_SHORTCUTS[n - 1]!.to)
  }

  onMounted(() => window.addEventListener('keydown', onKey))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
}
