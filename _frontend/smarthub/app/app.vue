<template>
  <div>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>

    <SettingsButton />
    <HomeButton />
  </div>
</template>

<script setup lang="ts">
import SettingsButton from './components/settings-button.vue'
import HomeButton from './components/home-button.vue'
</script>

<style scoped>
</style>