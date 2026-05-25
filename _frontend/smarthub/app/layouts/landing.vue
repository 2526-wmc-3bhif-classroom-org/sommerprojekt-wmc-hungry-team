<template>
  <div class="landing-layout">
    <slot />
  </div>
</template>

<style scoped>
.landing-layout {
  min-height: 100vh;
  margin: 0;

  display: flex;
  align-items: center;
  justify-content: center;

  font-family: 'Segoe UI', Arial, sans-serif;

  background: linear-gradient(135deg, #4889f3, #6466db);
}
</style>