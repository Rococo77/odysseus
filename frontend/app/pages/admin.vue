<script setup lang="ts">
import type { AdminUser } from '~/composables/useAdmin'

const { isAdmin } = useAuth()
const { users, fetchUsers, createUser, deleteUser, setPrivileges, wipe } = useAdmin()

const notice = ref<string | null>(null)
const busy = ref(false)

// New-user form
const nu = reactive({ username: '', password: '', is_admin: false })

onMounted(() => { if (isAdmin.value) load() })

async function load() {
  try { await fetchUsers() } catch (e) { flash(e instanceof Error ? e.message : 'Failed to load users') }
}

async function onCreate() {
  if (!nu.username.trim() || nu.password.length < 8) { flash('Username + 8-char password required'); return }
  busy.value = true
  try {
    await createUser(nu.username.trim(), nu.password, nu.is_admin)
    nu.username = ''; nu.password = ''; nu.is_admin = false
    await fetchUsers()
    flash('User created')
  } catch (e) { flash(e instanceof Error ? e.message : 'Create failed') }
  finally { busy.value = false }
}

async function onDelete(u: AdminUser) {
  if (!confirm(`Delete user "${u.username}"?`)) return
  try { await deleteUser(u.username); await fetchUsers(); flash('User deleted') }
  catch (e) { flash(e instanceof Error ? e.message : 'Delete failed') }
}

async function togglePriv(u: AdminUser, key: string, value: boolean) {
  const next = { ...u.privileges, [key]: value }
  try {
    const res = await setPrivileges(u.username, next)
    u.privileges = res.privileges ?? next
    flash('Privileges updated')
  } catch (e) { flash(e instanceof Error ? e.message : 'Update failed') }
}

async function onWipe(kind: string) {
  if (!confirm(`Permanently delete ALL ${kind}? This cannot be undone.`)) return
  try { const r = await wipe(kind); flash(`Wiped ${r.count} ${kind}`) }
  catch (e) { flash(e instanceof Error ? e.message : 'Wipe failed') }
}

let flashTimer: ReturnType<typeof setTimeout> | undefined
function flash(msg: string) {
  notice.value = msg
  clearTimeout(flashTimer)
  flashTimer = setTimeout(() => (notice.value = null), 2800)
}

const field = 'rounded-md border border-border bg-panel2 px-2.5 py-2 text-sm text-fg outline-none focus:border-accent'
</script>

<template>
  <section class="mx-auto max-w-3xl">
    <h1 class="mb-4 text-2xl font-semibold">Admin</h1>

    <p v-if="!isAdmin" class="py-10 text-center text-muted">Admins only.</p>

    <template v-else>
      <Transition name="fade">
        <p v-if="notice" class="mb-3 rounded-md border border-border bg-panel2 px-3 py-1.5 text-sm">{{ notice }}</p>
      </Transition>

      <!-- Users -->
      <div class="mb-4 rounded-card border border-border bg-panel p-4">
        <h2 class="mb-3 font-semibold">Users</h2>
        <div class="flex flex-col gap-3">
          <div v-for="u in users" :key="u.username" class="rounded-md border border-border bg-panel2 p-3">
            <div class="flex items-center justify-between">
              <div class="font-medium">
                {{ u.username }}
                <span v-if="u.is_admin" class="ml-1 rounded-full border border-accent px-1.5 text-[10px] text-accent">admin</span>
              </div>
              <button v-if="!u.is_admin" class="rounded-md border border-border px-2 py-0.5 text-xs text-fg hover:border-red hover:text-red" @click="onDelete(u)">Delete</button>
            </div>
            <div v-if="!u.is_admin" class="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              <label v-for="k in PRIVILEGE_KEYS" :key="k" class="flex items-center gap-1.5 text-xs text-muted">
                <input type="checkbox" class="accent-accent" :checked="u.privileges[k] === true" @change="togglePriv(u, k, ($event.target as HTMLInputElement).checked)" />
                {{ k.replace('can_', '').replace(/_/g, ' ') }}
              </label>
            </div>
          </div>
          <p v-if="!users.length" class="text-sm text-muted">No users.</p>
        </div>

        <hr class="my-3 border-border" />
        <div class="flex flex-wrap items-end gap-2">
          <input v-model="nu.username" :class="field" placeholder="New username" />
          <input v-model="nu.password" :class="field" type="password" placeholder="Password (8+)" />
          <label class="flex items-center gap-1.5 text-xs text-muted"><input v-model="nu.is_admin" type="checkbox" class="accent-accent" /> admin</label>
          <button class="rounded-md border border-accent bg-accent px-3 py-2 text-sm text-white disabled:opacity-50" :disabled="busy" @click="onCreate">Add user</button>
        </div>
      </div>

      <!-- Danger zone -->
      <div class="rounded-card border border-red/40 bg-panel p-4">
        <h2 class="mb-1 font-semibold text-red">Danger zone</h2>
        <p class="mb-3 text-xs text-muted">Permanently delete all data of a kind. Cannot be undone.</p>
        <div class="flex flex-wrap gap-2">
          <button v-for="k in WIPE_KINDS" :key="k" class="rounded-md border border-border px-2.5 py-1 text-xs text-fg hover:border-red hover:text-red" @click="onWipe(k)">
            Wipe {{ k }}
          </button>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
