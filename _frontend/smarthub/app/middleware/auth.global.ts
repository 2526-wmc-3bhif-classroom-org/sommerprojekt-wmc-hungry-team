export default defineNuxtRouteMiddleware(async (to) => {
  // Skip auth check during SSR - let client handle it
  if (process.server) return
  
  if (to.path === '/login') return

  const config = useRuntimeConfig()
  const apiBase = String(config.public.apiBaseUrl || '').replace(/\/$/, '')

  try {
    await $fetch(`${apiBase}/api/auth/me`, {
      credentials: 'include',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch {
    return navigateTo('/login')
  }
})
