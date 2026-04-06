<script setup>
definePageMeta({
  layout: "landing"
})
</script>

<template>
  <div class="home">
    <div class="home__card">
      <h1 class="home__title">Smart Dashboard</h1>
      <p class="home__subtitle">
        Dein persönliches Dashboard für Alltag, Termine und Routen
      </p>

      <NuxtLink to="/dashboard" class="home__button">
        Zum Dashboard →
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped>

/* ── Card ── */
.home__card {
  background: white;
  padding: 48px 40px;
  border-radius: 20px;

  text-align: center;
  max-width: 420px;
  width: 100%;

  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);

  display: flex;
  flex-direction: column;
  gap: 20px;

  animation: fadeIn 0.6s ease;
}

/* ── Title ── */
.home__title {
  font-size: 2rem;
  font-weight: 700;
  color: #1f2937;
}

/* ── Subtitle ── */
.home__subtitle {
  font-size: 1rem;
  color: #6b7280;
  line-height: 1.5;
}

/* ── Button ── */
.home__button {
  margin-top: 10px;

  display: inline-block;
  padding: 12px 20px;

  background: #3b82f6;
  color: white;
  font-weight: 600;

  border-radius: 10px;
  text-decoration: none;

  transition: all 0.2s ease;
}

.home__button:hover {
  background: #2563eb;
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(59, 130, 246, 0.3);
}

/* ── Animation ── */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>