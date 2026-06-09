import { ref, readonly, watch } from 'vue'

export type AlarmItem = {
  id: string
  time: string
  enabled: boolean
}

export type RoutineItem = {
  id: string
  startTime: string
  endTime: string
  destination: string
  startAddress: string
  transportMode: 'bus' | 'car'
  activeDays: number[] // 0 = Sun, 1 = Mon, ..., 6 = Sat
  alarms: AlarmItem[]
}

export type GlobalSettings = {
  clockType: 'digital' | 'analog'
}

export type Settings = {
  global?: GlobalSettings
  routines: RoutineItem[]
}

const STORAGE_KEY = 'smarthub-settings:v4'

function loadFromStorage(): Settings {
  if (typeof localStorage === 'undefined') {
    return { routines: [] }
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { routines: [] }
    return JSON.parse(raw)
  } catch (e) {
    console.warn('Failed to load settings', e)
    return { routines: [] }
  }
}

function save(s: Settings) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

export const state = ref<Settings>({ routines: [] })
const preview = ref<any | null>(null)
let hydrated = false

watch(state, (newState) => {
  if (hydrated) {
    save(newState)
  }
}, { deep: true })

export function useSettings() {
  if (!hydrated && typeof localStorage !== 'undefined') {
    state.value = loadFromStorage()
    if (!state.value.routines) state.value.routines = []
    hydrated = true
  }

  function getGlobalSettings() {
    if (!state.value.global) {
      state.value.global = { clockType: 'digital' }
    }
    return state.value.global
  }

  function addRoutineItem() {
    const now = new Date()
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    const currentTime = `${hh}:${mm}`
    
    const item: RoutineItem = {
      id: crypto.randomUUID(),
      startTime: currentTime,
      endTime: currentTime,
      destination: '',
      startAddress: '',
      transportMode: 'bus',
      activeDays: [1, 2, 3, 4, 5], // Default to Mon-Fri
      alarms: []
    }
    state.value.routines.push(item)
    save(state.value)
    return item
  }

  function updateRoutineItem(updated: RoutineItem) {
    const idx = state.value.routines.findIndex(r => r.id === updated.id)
    if (idx !== -1) {
      state.value.routines[idx] = updated
    }
    save(state.value)
  }

  function removeRoutineItem(id: string) {
    state.value.routines = state.value.routines.filter(r => r.id !== id)
    save(state.value)
  }

  function setPreview(p: any) {
    preview.value = p
  }

  function clearPreview() {
    preview.value = null
  }

  return {
    state,
    preview,
    getGlobalSettings,
    addRoutineItem,
    updateRoutineItem,
    removeRoutineItem,
    setPreview,
    clearPreview
  }
}
