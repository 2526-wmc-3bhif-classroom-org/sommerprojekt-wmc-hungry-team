<script setup lang="ts">
interface Stop {
  name: string
  time: string
  isTransfer: boolean
  transferInfo?: string
}

const routeStops: Stop[] = [
  { name: 'Linz/Donau Jäger im Tal', time: '07:45', isTransfer: false },
  { name: 'Linz/Donau Hbf', time: '08:02', isTransfer: true, transferInfo: 'Linie 230' },
  { name: 'Rohrbach B138 B127', time: '08:18', isTransfer: false },
  { name: 'Rohrbach B127 Wambacherberg', time: '08:30', isTransfer: false },
]

const travelTime = '45 Min'
const transferCount = 1
const arrivalTime = '08:30'
</script>

<template>
  <div class="bus-widget">
    <h3 class="bus-widget__title">Route</h3>

    <div class="bus-widget__timeline">
      <div class="bus-widget__line"></div>

      <div
        v-for="(stop, index) in routeStops"
        :key="index"
        class="bus-widget__stop"
      >
        <div
          class="bus-widget__stop-dot"
          :class="{ 'bus-widget__stop-dot--transfer': stop.isTransfer }"
        ></div>
        <div class="bus-widget__stop-info">
          <div class="bus-widget__stop-name">{{ stop.name }}</div>
          <div v-if="stop.isTransfer && stop.transferInfo" class="bus-widget__stop-transfer-wrapper">
            <span class="bus-widget__stop-transfer-badge">Umstieg</span>
            <span class="bus-widget__stop-transfer">{{ stop.transferInfo }}</span>
          </div>
        </div>
        <div class="bus-widget__stop-time">{{ stop.time }}</div>
      </div>
    </div>

    <div class="bus-widget__summary">
      <div class="bus-widget__summary-item">
        <div class="bus-widget__summary-label">Fahrzeit</div>
        <div class="bus-widget__summary-value">{{ travelTime }}</div>
      </div>
      <div class="bus-widget__summary-item">
        <div class="bus-widget__summary-label">Umstiege</div>
        <div class="bus-widget__summary-value">{{ transferCount }}</div>
      </div>
      <div class="bus-widget__summary-item">
        <div class="bus-widget__summary-label">Ankunft</div>
        <div class="bus-widget__summary-value">{{ arrivalTime }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bus-widget {
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  height: 100%;
  min-height: 0;
}

.bus-widget__title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #374151;
  margin: 0;
}

.bus-widget__timeline {
  position: relative;
  padding-left: 32px;
  flex: 1;
}

.bus-widget__line {
  position: absolute;
  left: 11px;
  top: 8px;
  bottom: 8px;
  width: 3px;
  background: #e5e7eb;
  border-radius: 2px;
}

.bus-widget__stop {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
}

.bus-widget__stop-dot {
  position: absolute;
  left: -26px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #3b82f6;
  border: 2px solid #ffffff;
  box-shadow: 0 0 0 2px #3b82f6;
  z-index: 1;
}

.bus-widget__stop-dot--transfer {
  width: 18px;
  height: 18px;
  left: -28px;
  background: #f59e0b;
  box-shadow: 0 0 0 2px #f59e0b;
}

.bus-widget__stop-info {
  flex: 1;
}

.bus-widget__stop-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #1f2937;
}

.bus-widget__stop-transfer-wrapper {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
}

.bus-widget__stop-transfer-badge {
  font-size: 0.75rem;
  font-weight: 700;
  color: #ffffff;
  background: #d97706;
  padding: 2px 8px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.bus-widget__stop-transfer {
  font-size: 0.875rem;
  color: #1f2937;
  font-weight: 600;
}

.bus-widget__stop-time {
  font-size: 0.875rem;
  font-weight: 600;
  color: #6b7280;
  min-width: 48px;
  text-align: right;
}

.bus-widget__summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  padding-top: 16px;
  border-top: 1px solid #f3f4f6;
  text-align: center;
}

.bus-widget__summary-label {
  font-size: 0.6875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #6b7280;
  margin-bottom: 4px;
}

.bus-widget__summary-value {
  font-size: 1.125rem;
  font-weight: 700;
  color: #1f2937;
}
</style>
