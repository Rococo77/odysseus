<script setup lang="ts">
// Login / first-run setup / signup. app.vue hides the chrome on this route.
const { status, fetchStatus, login, setup, signup } = useAuth()

const mode = ref<'login' | 'setup' | 'signup'>('login')
const username = ref('')
const password = ref('')
const remember = ref(true)
const totp = ref('')
const needsTotp = ref(false)
const busy = ref(false)
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    const s = await fetchStatus(true)
    if (s.authenticated) return navigateTo('/chat')
    if (!s.configured) mode.value = 'setup'
  } catch { /* offline → show login form anyway */ }
})

const signupEnabled = computed(() => !!status.value?.signup_enabled)

const title = computed(() => ({
  login: 'Sign in',
  setup: 'Create the admin account',
  signup: 'Create an account',
}[mode.value]))

async function submit() {
  if (busy.value) return
  error.value = null
  const u = username.value.trim()
  if (!u || !password.value) { error.value = 'Username and password are required.'; return }
  if (mode.value !== 'login' && password.value.length < 8) { error.value = 'Password must be at least 8 characters.'; return }

  busy.value = true
  try {
    if (mode.value === 'setup') {
      await setup(u, password.value)
      await login({ username: u, password: password.value, remember: true })
      return navigateTo('/chat')
    }
    if (mode.value === 'signup') {
      await signup(u, password.value)
      await login({ username: u, password: password.value, remember: true })
      return navigateTo('/chat')
    }
    const res = await login({ username: u, password: password.value, remember: remember.value, totp_code: totp.value || undefined })
    if (res.ok) return navigateTo('/chat')
    if (res.requires_totp) { needsTotp.value = true; error.value = 'Enter your 2FA code.' }
    else error.value = 'Login failed.'
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Login failed.'
  } finally {
    busy.value = false
  }
}

const field = 'w-full rounded-md border border-border bg-panel2 px-3 py-2 text-sm text-fg outline-none focus:border-accent'
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-bg p-4 text-fg">
    <form class="w-full max-w-sm rounded-card border border-border bg-panel p-6" @submit.prevent="submit">
      <h1 class="mb-1 text-xl font-semibold">Odysseus</h1>
      <p class="mb-4 text-sm text-muted">{{ title }}</p>

      <div class="flex flex-col gap-3">
        <input v-model="username" :class="field" type="text" placeholder="Username" autocomplete="username" autofocus >
        <input v-model="password" :class="field" type="password" placeholder="Password" :autocomplete="mode === 'login' ? 'current-password' : 'new-password'" >

        <input v-if="needsTotp" v-model="totp" :class="field" type="text" inputmode="numeric" placeholder="2FA code" autocomplete="one-time-code" >

        <label v-if="mode === 'login'" class="flex items-center gap-2 text-xs text-muted">
          <input v-model="remember" type="checkbox" class="accent-accent" > Remember me
        </label>
      </div>

      <p v-if="error" class="mt-3 text-sm text-red">{{ error }}</p>

      <button type="submit" class="mt-4 w-full rounded-md border border-accent bg-accent px-4 py-2 text-sm text-white disabled:opacity-50" :disabled="busy">
        {{ busy ? 'Please wait…' : title }}
      </button>

      <div v-if="mode !== 'setup'" class="mt-3 text-center text-xs text-muted">
        <button v-if="mode === 'login' && signupEnabled" type="button" class="text-accent hover:underline" @click="mode = 'signup'; error = null">
          Create an account
        </button>
        <button v-else-if="mode === 'signup'" type="button" class="text-accent hover:underline" @click="mode = 'login'; error = null">
          Back to sign in
        </button>
      </div>
    </form>
  </div>
</template>
