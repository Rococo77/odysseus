<script setup lang="ts">
import type { GalleryImage } from '~/types/gallery'

const props = defineProps<{ image: GalleryImage }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const { toBase64, sharpen, removeBg, denoise, upscale, enhanceFace, harmonize, replaceImage, saveAsNew } = useImageEditor()

const original = ref('')
const working = ref('')
const history = ref<string[]>([])
const busy = ref(false)
const busyLabel = ref('')
const err = ref<string | null>(null)

// Params
const sharpenAmount = ref(50)
const denoiseStrength = ref(0.5)
const upscaleScale = ref<2 | 4>(2)
const harmonizePrompt = ref('')
const harmonizeStrength = ref(0.45)

const src = computed(() => (working.value ? `data:image/png;base64,${working.value}` : ''))
const dirty = computed(() => working.value !== original.value)

onMounted(async () => {
  busy.value = true; busyLabel.value = 'Loading…'
  try { original.value = await toBase64(props.image.url); working.value = original.value }
  catch (e) { err.value = e instanceof Error ? e.message : 'Load failed' }
  finally { busy.value = false }
})

async function apply(label: string, fn: (img: string) => Promise<string>) {
  busy.value = true; busyLabel.value = label; err.value = null
  try {
    const next = await fn(working.value)
    history.value.push(working.value)
    working.value = next
  } catch (e) { err.value = e instanceof Error ? e.message : `${label} failed` }
  finally { busy.value = false }
}

function undo() { const prev = history.value.pop(); if (prev) working.value = prev }
function reset() { working.value = original.value; history.value = [] }

async function save(mode: 'replace' | 'new') {
  busy.value = true; busyLabel.value = 'Saving…'; err.value = null
  try {
    if (mode === 'replace') await replaceImage(props.image.id, working.value)
    else await saveAsNew(working.value)
    emit('saved')
    emit('close')
  } catch (e) { err.value = e instanceof Error ? e.message : 'Save failed' }
  finally { busy.value = false }
}

const btn = 'rounded-md border border-border bg-panel2 px-2.5 py-1.5 text-sm text-fg hover:border-accent disabled:opacity-50'
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" @click.self="emit('close')">
    <div class="flex max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-card border border-border bg-panel">
      <!-- Preview -->
      <div class="relative flex min-w-0 flex-1 items-center justify-center bg-black/40 p-2">
        <img v-if="src" :src="src" class="max-h-[88vh] max-w-full object-contain" />
        <div v-if="busy" class="absolute inset-0 flex items-center justify-center bg-black/50 text-sm text-white">{{ busyLabel || 'Processing…' }}</div>
      </div>

      <!-- Controls -->
      <div class="flex w-72 shrink-0 flex-col gap-3 overflow-auto border-l border-border p-3 text-sm">
        <div class="flex items-center justify-between">
          <h3 class="font-semibold">Edit image</h3>
          <button class="text-muted hover:text-fg" @click="emit('close')">✕</button>
        </div>

        <p v-if="err" class="rounded-md border border-red px-2 py-1 text-xs text-red">{{ err }}</p>

        <!-- One-click ops -->
        <div class="flex flex-col gap-2">
          <div class="flex flex-col gap-1">
            <label class="flex items-center justify-between text-xs text-muted">Sharpen <span>{{ sharpenAmount }}</span></label>
            <div class="flex gap-2">
              <input v-model.number="sharpenAmount" type="range" min="0" max="100" class="flex-1 accent-accent" />
              <button :class="btn" :disabled="busy" @click="apply('Sharpening…', img => sharpen(img, sharpenAmount))">Apply</button>
            </div>
          </div>

          <div class="flex flex-col gap-1">
            <label class="flex items-center justify-between text-xs text-muted">Denoise <span>{{ denoiseStrength.toFixed(2) }}</span></label>
            <div class="flex gap-2">
              <input v-model.number="denoiseStrength" type="range" min="0" max="1" step="0.05" class="flex-1 accent-accent" />
              <button :class="btn" :disabled="busy" @click="apply('Denoising…', img => denoise(img, denoiseStrength))">Apply</button>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button :class="[btn, 'flex-1']" :disabled="busy" @click="apply('Removing background…', removeBg)">Remove BG</button>
            <button :class="[btn, 'flex-1']" :disabled="busy" @click="apply('Enhancing face…', enhanceFace)">Enhance face</button>
          </div>

          <div class="flex items-center gap-2">
            <select v-model.number="upscaleScale" class="rounded-md border border-border bg-panel2 px-2 py-1.5 text-sm text-fg outline-none">
              <option :value="2">2×</option>
              <option :value="4">4×</option>
            </select>
            <button :class="[btn, 'flex-1']" :disabled="busy" @click="apply('Upscaling…', img => upscale(img, upscaleScale))">Upscale</button>
          </div>
        </div>

        <!-- Harmonize (prompt) -->
        <div class="flex flex-col gap-1 border-t border-border pt-3">
          <label class="text-xs text-muted">Harmonize (img2img · needs a diffusion server)</label>
          <input v-model="harmonizePrompt" placeholder="prompt (optional)" class="rounded-md border border-border bg-panel2 px-2 py-1.5 text-sm text-fg outline-none focus:border-accent" />
          <div class="flex items-center gap-2">
            <input v-model.number="harmonizeStrength" type="range" min="0.05" max="0.95" step="0.05" class="flex-1 accent-accent" />
            <span class="w-8 text-xs text-muted">{{ harmonizeStrength.toFixed(2) }}</span>
            <button :class="btn" :disabled="busy" @click="apply('Harmonizing…', img => harmonize(img, harmonizePrompt, harmonizeStrength))">Run</button>
          </div>
        </div>

        <!-- History -->
        <div class="flex gap-2 border-t border-border pt-3">
          <button :class="[btn, 'flex-1']" :disabled="busy || !history.length" @click="undo">Undo</button>
          <button :class="[btn, 'flex-1']" :disabled="busy || !dirty" @click="reset">Reset</button>
        </div>

        <!-- Save -->
        <div class="mt-auto flex flex-col gap-2 border-t border-border pt-3">
          <button class="rounded-md border border-accent bg-accent px-3 py-1.5 text-sm text-white disabled:opacity-50" :disabled="busy || !dirty" @click="save('replace')">Save (replace)</button>
          <button :class="btn" :disabled="busy || !dirty" @click="save('new')">Save as new</button>
        </div>
      </div>
    </div>
  </div>
</template>
