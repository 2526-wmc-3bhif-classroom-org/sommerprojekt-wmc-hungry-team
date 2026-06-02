export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/login') return

  const config = useRuntimeConfig()
  const apiBase = String(config.public.apiBaseUrl || '').replace(/\/$/, '')

  try {
    await $fetch(`${apiBase}/api/auth/me`, { credentials: 'include' })
  } catch {
    return navigateTo('/login')
  }
})
