<script setup lang="ts">
definePageMeta({
  layout: 'landing',
  middleware: ['redirect-dashboard']
})
</script>

<template>
  <div class="home__status">Weiterleitung…</div>
</template>

<style scoped>
.home__status {
  color: white;
  font-size: 1.2rem;
  font-weight: 600;
}
</style>