<template>
  <div class="profile-container">
    <button class="profile-btn" @click="isOpen = true" aria-label="Profile">
      <div class="profile-avatar">
        {{ initial }}
      </div>
    </button>

    <div v-if="isOpen" class="modal-overlay" @click.self="close">
      <div class="profile-modal">
        <button class="close-btn" @click="close"><i class="fa-solid fa-xmark"></i></button>
        
        <div class="modal-header">
          <div class="profile-avatar profile-avatar--large">
            {{ initial }}
          </div>
          <h2>{{ user?.name || 'User' }}</h2>
          <p class="user-email">{{ user?.email }}</p>
        </div>

        <form class="profile-form" @submit.prevent="saveProfile">
          <div class="form-group">
            <label>Name</label>
            <input type="text" v-model="form.name" placeholder="Name" required />
          </div>
          
          <div class="form-group">
            <label>Email</label>
            <input type="email" v-model="form.email" placeholder="Email" required />
          </div>
          
          <div class="form-group">
            <label>New Password (optional)</label>
            <input type="password" v-model="form.password" placeholder="Leave blank to keep current" />
          </div>

          <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
          <p v-if="successMsg" class="success-msg">{{ successMsg }}</p>

          <div class="modal-footer">
            <button type="submit" class="save-btn" :disabled="loading">
              {{ loading ? 'Saving...' : 'Save Changes' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useSmarthubApi } from '../composables/use-smarthub-api'

const api = useSmarthubApi()

const isOpen = ref(false)
const loading = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

const user = ref<{ id: string; email: string; name: string } | null>(null)

const form = ref({
  name: '',
  email: '',
  password: ''
})

const initial = computed(() => {
  if (!user.value?.name) return 'U'
  return user.value.name.charAt(0).toUpperCase()
})

async function fetchUser() {
  try {
    const res = await api.fetchMe()
    if (res && res.user) {
      user.value = res.user
      form.value.name = res.user.name
      form.value.email = res.user.email
    }
  } catch (err) {
    console.error('Error fetching user', err)
  }
}

onMounted(() => {
  fetchUser()
})

watch(isOpen, (newVal) => {
  if (newVal) {
    errorMsg.value = ''
    successMsg.value = ''
    form.value.password = ''
    fetchUser() // refresh data when opening
  }
})

function close() {
  isOpen.value = false
}

async function saveProfile() {
  errorMsg.value = ''
  successMsg.value = ''
  loading.value = true
  
  try {
    const updates: Record<string, string> = {}
    if (form.value.name && form.value.name !== user.value?.name) updates.name = form.value.name
    if (form.value.email && form.value.email !== user.value?.email) updates.email = form.value.email
    if (form.value.password) updates.password = form.value.password

    if (Object.keys(updates).length > 0) {
      await api.updateMe(updates)
      successMsg.value = 'Profile updated successfully!'
      form.value.password = ''
      await fetchUser() // reload new values
    } else {
      successMsg.value = 'No changes made.'
    }
  } catch (err: any) {
    errorMsg.value = err.message || 'Failed to update profile'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.profile-container {
  position: absolute;
  top: 24px;
  right: 24px;
  z-index: 40;
}

.profile-btn {
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  border-radius: 50%;
  transition: transform 0.2s ease;
}

.profile-btn:hover {
  transform: scale(1.05);
}

.profile-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--color-primary);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  font-weight: 600;
  box-shadow: var(--shadow-widget);
  border: 2px solid var(--bg-surface);
}

.profile-avatar--large {
  width: 72px;
  height: 72px;
  font-size: 2rem;
  margin: 0 auto 16px auto;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.profile-modal {
  background: var(--bg-surface);
  border-radius: 24px;
  width: 100%;
  max-width: 400px;
  padding: 32px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  position: relative;
  border: 1px solid var(--border-light);
  animation: modal-pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.close-btn {
  position: absolute;
  top: 20px;
  right: 20px;
  background: transparent;
  border: none;
  font-size: 1.5rem;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.close-btn:hover {
  background: var(--bg-surface-hover);
  color: var(--text-primary-strong);
}

.modal-header {
  text-align: center;
  margin-bottom: 32px;
}

.modal-header h2 {
  margin: 0 0 4px 0;
  color: var(--text-primary-strong);
  font-size: 1.5rem;
  font-weight: 600;
}

.user-email {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.95rem;
}

.profile-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.form-group input {
  padding: 12px 16px;
  border-radius: 12px;
  border: 1px solid var(--border-base);
  background: var(--bg-app);
  color: var(--text-primary);
  font-size: 1rem;
  font-family: inherit;
  transition: all 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  background: var(--bg-surface);
}

.modal-footer {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.save-btn {
  background: var(--color-primary);
  color: #ffffff;
  border: none;
  padding: 12px 24px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  width: 100%;
}

.save-btn:hover:not(:disabled) {
  background: var(--color-primary-dark);
  transform: translateY(-1px);
}

.save-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.error-msg {
  color: var(--color-error);
  font-size: 0.9rem;
  text-align: center;
  margin: 0;
}

.success-msg {
  color: var(--weather-dest-color);
  font-size: 0.9rem;
  text-align: center;
  margin: 0;
}

@keyframes modal-pop {
  from { opacity: 0; transform: scale(0.95) translateY(10px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
</style>
