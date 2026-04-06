<script setup lang="ts">
interface Appointment {
  time: string
  title: string
}

const appointments: Appointment[] = [
  { time: '09:00', title: 'Meeting' },
  { time: '12:00', title: 'Mittagessen' },
  { time: '15:00', title: 'Projekt Review' },
]
</script>

<template>
  <div class="appointments-widget">
    <h3 class="appointments-widget__title">Termine</h3>
    <div class="appointments-widget__list">
      <div
        v-for="(appt, index) in appointments"
        :key="index"
        class="appointments-widget__item"
      >
        <span class="appointments-widget__time">{{ appt.time }}</span>
        <span class="appointments-widget__title-text">{{ appt.title }}</span>
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
