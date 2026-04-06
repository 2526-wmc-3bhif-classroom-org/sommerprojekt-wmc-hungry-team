<script setup lang="ts">
</script>

<template>
  <div class="dashboard">
    <div class="dashboard__left">
      <clock-widget />
      <weather-widget />
      <appointments-widget />
    </div>
    <div class="dashboard__right">
      <bus-widget />
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  display: flex;
  gap: 20px;
  height: 100%;
}

.dashboard__left {
  display: flex;
  flex-direction: column;
  gap: 20px;
  flex: 1;
}

.dashboard__right {
  flex: 1.5;
}
</style>
