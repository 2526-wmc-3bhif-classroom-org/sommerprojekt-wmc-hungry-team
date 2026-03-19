<!-- src/layouts/DashboardLayout.vue -->
<template>
  <div class="dashboard-wrapper">

    <header class="header">
      <span>Smarthub</span>
      <span class="header-clock">{{ currentTime }}</span>
    </header>

    <main class="content">
      <slot />
    </main>

    <div class="hover-corner" @mouseenter="gearVisible = true" @mouseleave="gearVisible = false">
      <Transition name="gear">
        <button
            v-if="gearVisible"
            class="settings-gear"
            @click="$emit('open-settings')"
            title="Einstellungen öffnen"
        >
          ⚙
        </button>
      </Transition>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const currentTime = ref('')
const gearVisible = ref(false)

defineEmits(['open-settings'])

function updateClock() {
  currentTime.value = new Date().toLocaleTimeString('de-AT', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

let interval
onMounted(() => {
  updateClock()
  interval = setInterval(updateClock, 1000)
})
onUnmounted(() => clearInterval(interval))
</script>

<style scoped>
.dashboard-wrapper {
  min-height: 100vh;
  background: #f4f6f8;
  font-family: 'Segoe UI', Arial, sans-serif;
  display: flex;
  flex-direction: column;
}

/* HEADER */
.header {
  background: #3f5f7a;
  color: white;
  padding: 14px 26px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: clamp(14px, 1.5vw, 20px);
  flex-shrink: 0;
}

/* MAIN — the slot fills remaining height */
.content {
  flex: 1;
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 18px;
  padding: 20px;
  height: calc(100vh - 60px);
}

/* GEAR */
.hover-corner {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 80px;
  height: 80px;
  z-index: 10;
  display: flex;
  align-items: flex-end;
  padding: 16px;
}

.settings-gear {
  background: white;
  border: none;
  border-radius: 50%;
  width: 50px;
  height: 50px;
  font-size: 22px;
  color: #3f5f7a;
  cursor: pointer;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
  display: flex;
  justify-content: center;
  align-items: center;
  transition: transform 0.2s;
}
.settings-gear:hover {
  transform: rotate(20deg);
}

/* GEAR FADE TRANSITION */
.gear-enter-active, .gear-leave-active { transition: opacity 0.25s; }
.gear-enter-from, .gear-leave-to { opacity: 0; }
</style>