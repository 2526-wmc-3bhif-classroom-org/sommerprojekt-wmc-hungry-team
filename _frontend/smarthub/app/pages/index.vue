<script setup lang="ts">
definePageMeta({
  layout: 'landing',
  middleware: 'auth'
})

onMounted(async () => {
  await navigateTo('/dashboard')
})
</script>

<template>
  <div class="home__status">Lade Dashboard…</div>
</template>

<style scoped>
.home__status {
  color: white;
  font-size: 1.2rem;
  font-weight: 600;
}
</style>