// Gate every route on auth status. SPA (ssr:false) → runs client-side.
// /login is always reachable; everything else requires an authenticated
// session, otherwise we redirect to /login (which also handles first-run setup).
export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/login') return
  const { fetchStatus } = useAuth()
  try {
    const s = await fetchStatus()
    if (!s.authenticated) return navigateTo('/login')
  } catch {
    return navigateTo('/login')
  }
})
