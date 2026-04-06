<template>
  <div class="dashboard-wrapper">
    <main class="content">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.dashboard-wrapper {
  height: 100vh;
  background: #f4f6f8;
  font-family: 'Segoe UI', Arial, sans-serif;
  display: flex;
  flex-direction: column;
}

.content {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: 20px;
  padding: 24px;
  overflow: hidden;
}
</style>
