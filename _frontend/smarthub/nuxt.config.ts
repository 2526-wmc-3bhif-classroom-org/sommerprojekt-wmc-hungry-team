// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  ssr: false,
  css: ['~/assets/css/theme.css'],
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
      apiBaseUrl: '',
    },
  },
  vite: {
    server: {
      proxy: {
        '/api': {
          target: 'http://backend:3000',
          changeOrigin: true,
        }
      }
    }
  }
})
