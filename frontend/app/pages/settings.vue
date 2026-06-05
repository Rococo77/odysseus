<script setup lang="ts">
// Settings: per-user default model (everyone) + curated server settings (admin).
const { isAdmin } = useAuth()
const { request } = useApi()
const { modelOptions, fetchEndpoints } = useModels()
const { getPrefs, setPref, getSettings, saveSettings } = useSettings()

const notice = ref<string | null>(null)
const saving = ref(false)

// Default model (per-user)
const defaultModel = ref('') // "endpoint_id::model"
// Server settings (admin) — full dict kept so unedited keys are preserved
const settings = ref<Record<string, unknown>>({})
const signupEnabled = ref(false)

onMounted(async () => {
  try {
    await fetchEndpoints()
    const prefs = await getPrefs()
    const ep = prefs.default_endpoint_id as string | undefined
    const m = prefs.default_model as string | undefined
    if (ep && m) defaultModel.value = `${ep}::${m}`
    if (isAdmin.value) {
      settings.value = await getSettings()
    }
    const status = await request<{ signup_enabled: boolean }>('/api/auth/status')
    signupEnabled.value = !!status.signup_enabled
  } catch (e) {
    flash(e instanceof Error ? e.message : 'Failed to load settings')
  }
})

async function saveDefaultModel() {
  const [endpoint_id, model] = defaultModel.value.split('::')
  if (!endpoint_id || !model) return
  saving.value = true
  try {
    await setPref('default_endpoint_id', endpoint_id)
    await setPref('default_model', model)
    flash('Default model saved')
  } catch (e) { flash(e instanceof Error ? e.message : 'Save failed') }
  finally { saving.value = false }
}

async function saveServer() {
  saving.value = true
  try {
    settings.value = await saveSettings(settings.value)
    flash('Server settings saved')
  } catch (e) { flash(e instanceof Error ? e.message : 'Save failed') }
  finally { saving.value = false }
}

async function toggleSignup() {
  try {
    const res = await request<{ signup_enabled: boolean }>('/api/auth/signup-toggle', { method: 'POST' })
    signupEnabled.value = res.signup_enabled
    flash(`Signup ${res.signup_enabled ? 'enabled' : 'disabled'}`)
  } catch (e) { flash(e instanceof Error ? e.message : 'Toggle failed') }
}

const bool = (k: string) => settings.value[k] === true
function setBool(k: string, v: boolean) { settings.value = { ...settings.value, [k]: v } }

let flashTimer: ReturnType<typeof setTimeout> | undefined
function flash(msg: string) {
  notice.value = msg
  clearTimeout(flashTimer)
  flashTimer = setTimeout(() => (notice.value = null), 2500)
}

const field = 'rounded-md border border-border bg-panel2 px-2.5 py-2 text-sm text-fg outline-none focus:border-accent'
</script>

<template>
  <section class="mx-auto max-w-2xl">
    <h1 class="mb-4 text-2xl font-semibold">Settings</h1>

    <Transition name="fade">
      <p v-if="notice" class="mb-3 rounded-md border border-border bg-panel2 px-3 py-1.5 text-sm">{{ notice }}</p>
    </Transition>

    <!-- Preferences -->
    <div class="mb-4 rounded-card border border-border bg-panel p-4">
      <h2 class="mb-3 font-semibold">Preferences</h2>
      <label class="flex flex-col gap-1 text-xs text-muted">
        <span>Default model for new chats</span>
        <div class="flex gap-2">
          <select v-model="defaultModel" :class="[field, 'flex-1']">
            <option value="">— Use server default —</option>
            <option v-for="o in modelOptions" :key="`${o.endpoint_id}::${o.model}`" :value="`${o.endpoint_id}::${o.model}`">
              {{ o.model }} · {{ o.endpoint_name }}
            </option>
          </select>
          <button class="rounded-md border border-accent bg-accent px-3 py-1.5 text-sm text-white disabled:opacity-50" :disabled="saving || !defaultModel" @click="saveDefaultModel">Save</button>
        </div>
      </label>
    </div>

    <!-- Server settings (admin) -->
    <div v-if="isAdmin" class="rounded-card border border-border bg-panel p-4">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="font-semibold">Server settings <span class="text-xs font-normal text-muted">admin</span></h2>
        <button class="rounded-md border border-accent bg-accent px-3 py-1.5 text-sm text-white disabled:opacity-50" :disabled="saving" @click="saveServer">Save</button>
      </div>

      <div class="flex flex-col gap-2.5 text-sm">
        <label class="flex items-center justify-between">
          <span>Image generation</span>
          <input type="checkbox" class="accent-accent" :checked="bool('image_gen_enabled')" @change="setBool('image_gen_enabled', ($event.target as HTMLInputElement).checked)" />
        </label>
        <label class="flex items-center justify-between">
          <span>Text-to-speech</span>
          <input type="checkbox" class="accent-accent" :checked="bool('tts_enabled')" @change="setBool('tts_enabled', ($event.target as HTMLInputElement).checked)" />
        </label>
        <label class="flex items-center justify-between">
          <span>Speech-to-text</span>
          <input type="checkbox" class="accent-accent" :checked="bool('stt_enabled')" @change="setBool('stt_enabled', ($event.target as HTMLInputElement).checked)" />
        </label>
        <label class="flex items-center justify-between gap-3">
          <span>Reminder channel</span>
          <select :class="field" :value="(settings.reminder_channel as string) || 'browser'" @change="settings = { ...settings, reminder_channel: ($event.target as HTMLSelectElement).value }">
            <option value="browser">Browser</option>
            <option value="email">Email</option>
            <option value="ntfy">ntfy</option>
          </select>
        </label>
      </div>

      <hr class="my-3 border-border" />
      <label class="flex items-center justify-between text-sm">
        <span>Allow new account signups</span>
        <button class="rounded-md border px-2.5 py-1 text-xs" :class="signupEnabled ? 'border-green text-green' : 'border-border text-muted'" @click="toggleSignup">
          {{ signupEnabled ? 'Enabled' : 'Disabled' }}
        </button>
      </label>
    </div>
  </section>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
