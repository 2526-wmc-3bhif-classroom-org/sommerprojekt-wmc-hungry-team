<template>
  <NuxtLink to="/" class="home-button" aria-label="Startseite">
    🏠
  </NuxtLink>
</template>

<script setup lang="ts">
</script>

<style scoped>
.home-button {
  position: fixed;
  left: 68px;
  bottom: 18px;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #111827;
  color: white;
  border-radius: 12px;
  box-shadow: 0 6px 18px rgba(17,24,39,0.35);
  text-decoration: none;
  font-size: 20px;
}
.home-button:hover { transform: translateY(-2px); }
</style>
