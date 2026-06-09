<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import { useSmarthubApi } from '../composables/use-smarthub-api'
import type { AutocompleteResult } from '../composables/use-smarthub-api'

const props = defineProps<{
  modelValue: string
  placeholder?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const { autocompletePlace } = useSmarthubApi()

const inputValue = ref(props.modelValue)
const suggestions = ref<AutocompleteResult[]>([])
const showSuggestions = ref(false)
const loading = ref(false)
let debounceTimeout: any = null

watch(() => props.modelValue, (newVal) => {
  if (newVal !== inputValue.value) {
    inputValue.value = newVal
  }
})

const fetchSuggestions = async (query: string) => {
  if (!query || query.length < 2) {
    suggestions.value = []
    showSuggestions.value = false
    return
  }
  
  loading.value = true
  try {
    const results = await autocompletePlace(query)
    suggestions.value = results
    showSuggestions.value = results.length > 0
  } catch (e) {
    console.error('Failed to fetch suggestions', e)
    suggestions.value = []
  } finally {
    loading.value = false
  }
}

const onInput = (e: Event) => {
  const value = (e.target as HTMLInputElement).value
  inputValue.value = value
  emit('update:modelValue', value)
  
  clearTimeout(debounceTimeout)
  debounceTimeout = setTimeout(() => {
    fetchSuggestions(value)
  }, 300)
}

const selectSuggestion = (desc: string) => {
  inputValue.value = desc
  emit('update:modelValue', desc)
  showSuggestions.value = false
}

// Hide dropdown when clicking outside (simple approach: hide on blur with a delay so click registers)
const onBlur = () => {
  setTimeout(() => {
    showSuggestions.value = false
  }, 200)
}

onBeforeUnmount(() => {
  clearTimeout(debounceTimeout)
})
</script>

<template>
  <div class="autocomplete-wrapper" :class="{ 'is-disabled': disabled }">
    <input
      type="text"
      class="autocomplete-input"
      :value="inputValue"
      :placeholder="placeholder"
      :disabled="disabled"
      @input="onInput"
      @blur="onBlur"
      @focus="() => { if (suggestions.length > 0) showSuggestions = true }"
    />
    <div v-if="loading" class="autocomplete-loading">...</div>
    
    <ul v-if="showSuggestions && !disabled" class="autocomplete-dropdown">
      <li 
        v-for="s in suggestions" 
        :key="s.place_id" 
        class="autocomplete-item"
        @click="selectSuggestion(s.description)"
      >
        {{ s.description }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.autocomplete-wrapper {
  position: relative;
  display: flex;
  flex: 1;
}

.autocomplete-wrapper.is-disabled {
  opacity: 0.5;
}

.autocomplete-input {
  width: 100%;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  background: #f9fafb;
  font-family: inherit;
  font-size: 0.95rem;
  font-weight: 500;
  color: #111827;
  transition: all 0.2s;
}

.autocomplete-input:focus {
  outline: none;
  border-color: #3b82f6;
  background: white;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.autocomplete-input:disabled {
  background-color: #f3f4f6;
  cursor: not-allowed;
}

.autocomplete-loading {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: #9ca3af;
  font-size: 0.8rem;
}

.autocomplete-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  z-index: 50;
  list-style: none;
  padding: 0;
  max-height: 250px;
  overflow-y: auto;
}

.autocomplete-item {
  padding: 10px 12px;
  cursor: pointer;
  font-size: 0.9rem;
  color: #374151;
  border-bottom: 1px solid #f3f4f6;
}

.autocomplete-item:last-child {
  border-bottom: none;
}

.autocomplete-item:hover {
  background-color: #f3f4f6;
}
</style>
