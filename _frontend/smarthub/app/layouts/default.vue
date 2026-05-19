<template>
  <div class="wrapper">
    <header class="header">
      <NuxtLink class="header__brand" to="/dashboard">SmartHub</NuxtLink>
      <nav class="header__nav">
        <NuxtLink class="header__link" to="/dashboard">Dashboard</NuxtLink>
        <NuxtLink class="header__link" to="/routine-settings">Einstellungen</NuxtLink>
      </nav>
    </header>
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

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: #ffffff;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.08);
}

.header__brand {
  font-weight: 700;
  color: #1f2937;
  text-decoration: none;
}

.header__nav {
  display: flex;
  gap: 16px;
}

.header__link {
  color: #2563eb;
  text-decoration: none;
  font-weight: 600;
}

.content {
  flex: 1;
  padding: 24px;
  overflow: auto;
}
</style>
