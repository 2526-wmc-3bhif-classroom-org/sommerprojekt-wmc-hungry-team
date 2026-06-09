<template>
  <div>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>

    <SettingsButton v-if="$route.path !== '/login'" />
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import SettingsButton from './components/settings-button.vue'

const route = useRoute()
</script>

<style scoped>
</style>