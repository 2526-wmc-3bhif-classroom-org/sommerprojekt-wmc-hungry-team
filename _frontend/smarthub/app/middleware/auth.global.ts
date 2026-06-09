export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/login') return

  const config = useRuntimeConfig()
  const apiBase = String(config.public.apiBaseUrl || '').replace(/\/$/, '')

  try {
    await $fetch(`${apiBase}/api/auth/me`, {
      credentials: 'include',
      headers: process.server ? useRequestHeaders(['cookie']) : undefined,
    })
  } catch {
    return navigateTo('/login')
  }
})
