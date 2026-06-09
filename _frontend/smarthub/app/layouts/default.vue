<template>
  <div class="wrapper">
    <main class="content">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.wrapper {
  height: 100vh;
  background: #f4f6f8;
  font-family: 'Segoe UI', Arial, sans-serif;
  display: flex;
  flex-direction: column;
}

.content {
  flex: 1;
  padding: 24px;
  overflow: auto;
}
</style>
