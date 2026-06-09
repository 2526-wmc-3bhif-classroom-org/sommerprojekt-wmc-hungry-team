<template>
  <div class="settings-hover-zone">
    <NuxtLink to="/settings" class="settings-button" aria-label="Settings">
      ⚙️
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.settings-hover-zone {
  position: fixed;
  left: 0;
  bottom: 0;
  width: 120px;
  height: 120px;
  z-index: 50;
}

.settings-button {
  position: absolute;
  left: 24px;
  bottom: 24px;
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #111827;
  color: white;
  border-radius: 16px;
  box-shadow: 0 10px 25px rgba(17,24,39,0.35);
  text-decoration: none;
  font-size: 32px;
  
  opacity: 0;
  transform: translateY(20px) scale(0.8);
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.settings-hover-zone:hover .settings-button {
  opacity: 1;
  transform: translateY(0) scale(1);
}
</style>
