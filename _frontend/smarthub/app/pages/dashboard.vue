<script setup lang="ts">
</script>

<template>
  <div class="dashboard">
    <div class="dashboard__left">
      <clock-widget class="dashboard__clock" />
      <weather-widget class="dashboard__weather" />
      <appointments-widget class="dashboard__appointments" />
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
  width: 35%;
  min-width: 320px;
}

.dashboard__clock {
  flex: 1.2;
}

.dashboard__weather {
  flex: 0.6;
}

.dashboard__appointments {
  flex: 1;
}

.dashboard__right {
  width: 65%;
  min-width: 0;
}
</style>
