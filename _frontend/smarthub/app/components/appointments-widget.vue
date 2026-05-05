<script setup lang="ts">
const loading = ref(true)
const error = ref('')
const serviceStatus = ref<{
  backend: string
  neo4j: 'up' | 'down'
  timestamp: string
} | null>(null)

const { fetchServiceStatus } = useSmarthubApi()

const timestampDisplay = computed(() => {
  if (!serviceStatus.value) return '--'
  return new Date(serviceStatus.value.timestamp).toLocaleString('de-AT')
})

onMounted(async () => {
  try {
    const response = await fetchServiceStatus()
    serviceStatus.value = {
      backend: response.backend,
      neo4j: response.neo4j,
      timestamp: response.timestamp,
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Backend-Status konnte nicht geladen werden'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="appointments-widget">
    <h3 class="appointments-widget__title">Backend Status</h3>
    <div v-if="loading" class="appointments-widget__status">Lade Status...</div>
    <div v-else-if="error" class="appointments-widget__status appointments-widget__status--error">{{ error }}</div>
    <div v-else-if="serviceStatus" class="appointments-widget__list">
      <div class="appointments-widget__item">
        <span class="appointments-widget__time">API</span>
        <span class="appointments-widget__title-text">{{ serviceStatus.backend }}</span>
      </div>
      <div class="appointments-widget__item">
        <span class="appointments-widget__time">Neo4j</span>
        <span class="appointments-widget__title-text">{{ serviceStatus.neo4j }}</span>
      </div>
      <div class="appointments-widget__item">
        <span class="appointments-widget__time">Zuletzt</span>
        <span class="appointments-widget__title-text">{{ timestampDisplay }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.appointments-widget {
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.appointments-widget__title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #374151;
  margin: 0;
}

.appointments-widget__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.appointments-widget__status {
  color: #6b7280;
  font-size: 0.95rem;
}

.appointments-widget__status--error {
  color: #b91c1c;
}

.appointments-widget__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #f3f4f6;
}

.appointments-widget__item:last-child {
  border-bottom: none;
}

.appointments-widget__time {
  font-size: 0.875rem;
  font-weight: 600;
  color: #6b7280;
  min-width: 50px;
}

.appointments-widget__title-text {
  font-size: 1rem;
  color: #1f2937;
}
</style>
