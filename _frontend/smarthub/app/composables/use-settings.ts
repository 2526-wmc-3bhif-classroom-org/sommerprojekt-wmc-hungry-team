import { ref } from 'vue'

export type AlarmItem = {
  id: string
  time: string
  enabled: boolean
}

export type RoutineItem = {
  id: string
  name: string
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
  global: GlobalSettings
  routines: RoutineItem[]
}

// Module-level reactive state (shared across all components)
const state = ref<Settings>({
  global: { clockType: 'digital' },
  routines: []
})
const preview = ref<any | null>(null)
let loaded = false
let loading: Promise<void> | null = null

// Convert API routine response to frontend RoutineItem
function apiToRoutineItem(r: any): RoutineItem {
  return {
    id: r.id,
    name: r.name || 'Routine',
    startTime: r.startTime || '08:00',
    endTime: r.endTime || '09:00',
    destination: r.destination || '',
    startAddress: r.startAddress || '',
    transportMode: r.transportMode || 'bus',
    activeDays: r.days || [],
    alarms: r.config?.alarms || []
  }
}

// Convert frontend RoutineItem to API request body
function routineItemToApi(item: RoutineItem): Record<string, unknown> {
  return {
    name: item.name || 'Routine',
    start_time: item.startTime,
    end_time: item.endTime,
    days: item.activeDays || [],
    transport_mode: item.transportMode || 'bus',
    destination: item.destination || '',
    start_address: item.startAddress || '',
    config: {
      alarms: item.alarms || []
    }
  }
}

async function doLoad() {
  const { fetchSettings, fetchRoutines } = useSmarthubApi()
  try {
    const [settings, routines] = await Promise.all([
      fetchSettings(),
      fetchRoutines()
    ])
    state.value.global = {
      clockType: (settings as any).clockType || 'digital'
    }
    state.value.routines = routines.map(apiToRoutineItem)
    loaded = true
  } catch (e) {
    console.error('Failed to load settings from server', e)
    // Keep defaults
    loaded = true
  }
}

export { state }

export function useSettings() {
  // Load from API once
  if (!loaded && !loading) {
    loading = doLoad().finally(() => { loading = null })
  }

  function getGlobalSettings(): GlobalSettings {
    return state.value.global
  }

  async function loadFromServer() {
    await doLoad()
  }

  async function saveGlobalSettings() {
    const { updateSettings } = useSmarthubApi()
    try {
      await updateSettings({ clockType: state.value.global.clockType })
    } catch (e) {
      console.error('Failed to save settings', e)
    }
  }

  async function addRoutineItem(): Promise<RoutineItem> {
    const { createRoutine } = useSmarthubApi()
    const now = new Date()
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    const currentTime = `${hh}:${mm}`

    const newItem: RoutineItem = {
      id: crypto.randomUUID(), // temporary
      name: 'Routine',
      startTime: currentTime,
      endTime: currentTime,
      destination: '',
      startAddress: '',
      transportMode: 'bus',
      activeDays: [1, 2, 3, 4, 5],
      alarms: []
    }

    try {
      const created = await createRoutine(routineItemToApi(newItem))
      const item = apiToRoutineItem(created)
      state.value.routines.push(item)
      return item
    } catch (e) {
      console.error('Failed to create routine', e)
      // Add locally as fallback
      state.value.routines.push(newItem)
      return newItem
    }
  }

  async function updateRoutineItem(updated: RoutineItem) {
    const idx = state.value.routines.findIndex(r => r.id === updated.id)
    if (idx !== -1) {
      state.value.routines[idx] = { ...updated }
    }

    // Debounced save to server
    debouncedSaveRoutine(updated)
  }

  // Debounce map for routine saves
  const saveTimers = new Map<string, ReturnType<typeof setTimeout>>()

  function debouncedSaveRoutine(item: RoutineItem) {
    const existing = saveTimers.get(item.id)
    if (existing) clearTimeout(existing)

    saveTimers.set(item.id, setTimeout(async () => {
      saveTimers.delete(item.id)
      const { updateRoutine } = useSmarthubApi()
      try {
        await updateRoutine(item.id, routineItemToApi(item))
      } catch (e) {
        console.error('Failed to update routine', e)
      }
    }, 500))
  }

  async function removeRoutineItem(id: string) {
    state.value.routines = state.value.routines.filter(r => r.id !== id)
    const { deleteRoutine } = useSmarthubApi()
    try {
      await deleteRoutine(id)
    } catch (e) {
      console.error('Failed to delete routine', e)
    }
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
    clearPreview,
    saveGlobalSettings,
    loadFromServer,
  }
}
