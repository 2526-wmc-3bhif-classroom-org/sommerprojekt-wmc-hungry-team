<template>
  <div class="dp-popup-wrapper" ref="wrapper">
    <input
      class="dp-input"
      :value="displayValue"
      @click="toggle"
      readonly
      placeholder="Select date"
      aria-haspopup="dialog"
      aria-expanded="open"
    />

    <div v-if="open" class="dp-popup" role="dialog">
      <DatePicker v-model="internalValue" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import DatePicker from './date-picker.vue'

const props = defineProps({ modelValue: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue'])

const wrapper = ref<HTMLElement | null>(null)
const open = ref(false)
const internalValue = ref(props.modelValue)

watch(() => props.modelValue, v => { internalValue.value = v })
watch(internalValue, v => emit('update:modelValue', v))

function toggle() { open.value = !open.value }

function onDocClick(e: MouseEvent) {
  const el = wrapper.value
  if (!el) return
  if (!el.contains(e.target as Node)) open.value = false
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKey)
})

const displayValue = computed(() => {
  if (!internalValue.value) return ''
  try {
    const d = new Date(internalValue.value)
    return d.toLocaleDateString()
  } catch {
    return internalValue.value
  }
})
</script>

<style scoped>
.dp-popup-wrapper { position: relative; display: inline-block }
.dp-input { padding:8px 10px; border-radius:8px; border:1px solid var(--border-base); min-width:160px; cursor:pointer }
.dp-popup { position: absolute; top: calc(100% + 8px); left: 0; z-index: 40 }
</style>