<template>
  <div class="home">
    <h1>Welcome to the homepage</h1>
    <h3>Still under construction</h3>
    <a href="/dashboard" class="home__link">go to /dashboard</a>
  </div>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
}

.home h1 {
  font-size: 1.5rem;
  color: #1f2937;
}

.home__link {
  color: #3b82f6;
  font-size: 1rem;
  text-decoration: underline;
}

.home__link:hover {
  color: #2563eb;
}
</style>
