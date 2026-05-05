import { ref, readonly } from 'vue'

export type RoutineItem = {
  id: string
  time: string // HH:MM or HH:MM:SS
  title: string
  location?: string
}

export type AlarmItem = {
  id: string
  time: string // HH:MM or HH:MM:SS
  repeat: boolean
  enabled: boolean
}

export type DaySettings = {
  alarms: AlarmItem[]
  routine: RoutineItem[]
}

export type Settings = {
  homeLocation?: string
  days: Record<string, DaySettings>
}

const STORAGE_KEY = 'smarthub-settings:v1'

function emptyDay(): DaySettings {
  return { alarms: [], routine: [] }
}

function load(): Settings {
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

// Shared, module-level state so multiple components see the same preview
const state = ref<Settings>(load())
const preview = ref<any | null>(null)

export function useSettings() {
  function ensureDay(dayKey: string) {
    if (!state.value.days[dayKey]) state.value.days[dayKey] = emptyDay()
  }

  function getDay(dayKey: string) {
    ensureDay(dayKey)
    return state.value.days[dayKey]
  }

  function setHomeLocation(loc: string) {
    state.value.homeLocation = loc
    save(state.value)
  }

  function addAlarm(dayKey: string, time = '08:00') {
    ensureDay(dayKey)
    const alarm: AlarmItem = { id: crypto.randomUUID(), time, repeat: true, enabled: true }
    state.value.days[dayKey].alarms.push(alarm)
    save(state.value)
    return alarm
  }

  function updateAlarm(dayKey: string, updated: AlarmItem) {
    ensureDay(dayKey)
    const idx = state.value.days[dayKey].alarms.findIndex(a => a.id === updated.id)
    if (idx !== -1) state.value.days[dayKey].alarms.splice(idx, 1, updated)
    save(state.value)
  }

  function removeAlarm(dayKey: string, id: string) {
    ensureDay(dayKey)
    state.value.days[dayKey].alarms = state.value.days[dayKey].alarms.filter(a => a.id !== id)
    save(state.value)
  }

  function addRoutineItem(dayKey: string, title = 'New', time = '10:00', location?: string) {
    ensureDay(dayKey)
    const item: RoutineItem = { id: crypto.randomUUID(), title, time, location }
    state.value.days[dayKey].routine.push(item)
    save(state.value)
    return item
  }

  function updateRoutineItem(dayKey: string, updated: RoutineItem) {
    ensureDay(dayKey)
    const idx = state.value.days[dayKey].routine.findIndex(r => r.id === updated.id)
    if (idx !== -1) state.value.days[dayKey].routine.splice(idx, 1, updated)
    save(state.value)
  }

  function removeRoutineItem(dayKey: string, id: string) {
    ensureDay(dayKey)
    state.value.days[dayKey].routine = state.value.days[dayKey].routine.filter(r => r.id !== id)
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
    setHomeLocation,
    addAlarm,
    updateAlarm,
    removeAlarm,
    addRoutineItem,
    updateRoutineItem,
    removeRoutineItem,
    resetAll,
    setPreview,
    clearPreview,
  }
}
