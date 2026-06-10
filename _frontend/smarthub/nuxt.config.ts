// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  ssr: false,
  modules: ['@tailwindcss/vite'],
  app: {
    head: {
      script: [
        { src: 'https://kit.fontawesome.com/e7cf439639.js', crossorigin: 'anonymous' }
      ]
    }
  },
  runtimeConfig: {
    public: {
      apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000',
    },
  },
})
