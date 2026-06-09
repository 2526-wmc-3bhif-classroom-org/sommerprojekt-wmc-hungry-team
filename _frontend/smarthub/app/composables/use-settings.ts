import { ref, readonly } from 'vue'

export type RoutineItem = {
  id: string
  startTime: string
  alarmTime: string
  destination: string
  startAddress: string
  transportMode: 'bus' | 'car'
}

export type DaySettings = {
  routines: RoutineItem[]
}

export type Settings = {
  days: Record<string, DaySettings>
}

const STORAGE_KEY = 'smarthub-settings:v2'

function emptyDay(): DaySettings {
  return { routines: [] }
}

function loadFromStorage(): Settings {
  if (typeof localStorage === 'undefined') {
    return { days: {} }
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { days: {} }
    return JSON.parse(raw)
  } catch (e) {
    console.warn('Failed to load settings', e)
    return { days: {} }
  }
}

function save(s: Settings) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

// Shared, module-level state so multiple components see the same preview
const state = ref<Settings>({ days: {} })
const preview = ref<any | null>(null)
let hydrated = false

export function useSettings() {
  if (!hydrated && typeof localStorage !== 'undefined') {
    state.value = loadFromStorage()
    hydrated = true
  }

  function ensureDay(dayKey: string) {
    if (!state.value.days[dayKey]) state.value.days[dayKey] = emptyDay()
  }

  function getDay(dayKey: string) {
    ensureDay(dayKey)
    return state.value.days[dayKey]
  }

  function addRoutineItem(dayKey: string) {
    ensureDay(dayKey)
    const now = new Date()
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    const currentTime = `${hh}:${mm}`
    
    const item: RoutineItem = {
      id: crypto.randomUUID(),
      startTime: currentTime,
      alarmTime: currentTime,
      destination: '',
      startAddress: '',
      transportMode: 'bus'
    }
    state.value.days[dayKey].routines.push(item)
    save(state.value)
    return item
  }

  function updateRoutineItem(dayKey: string, updated: RoutineItem) {
    ensureDay(dayKey)
    const idx = state.value.days[dayKey].routines.findIndex(r => r.id === updated.id)
    if (idx !== -1) state.value.days[dayKey].routines.splice(idx, 1, updated)
    save(state.value)
  }

  function removeRoutineItem(dayKey: string, id: string) {
    ensureDay(dayKey)
    state.value.days[dayKey].routines = state.value.days[dayKey].routines.filter(r => r.id !== id)
    save(state.value)
  }

  function resetAll() {
    state.value = { days: {} }
    save(state.value)
  }

  function setPreview(data: any) {
    preview.value = data
  }

  function clearPreview() {
    preview.value = null
  }

  return {
    state: readonly(state),
    preview,
    getDay,
    addRoutineItem,
    updateRoutineItem,
    removeRoutineItem,
    resetAll,
    setPreview,
    clearPreview,
  }
}
