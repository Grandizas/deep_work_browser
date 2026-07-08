<script setup lang="ts">
// Procedurally-synthesized ambient sound (no audio assets): filtered noise via
// Web Audio. Main owns which sound plays (store.ambientSound); this component
// just reflects it. Ducks when a tab plays audio (store.ambientDucked).
import { ref, watch, onBeforeUnmount } from 'vue'
import { useBrowserStore } from '../stores/browser'

const store = useBrowserStore()

// Reflected onto the hidden element's data-* so the running AudioContext state is
// observable (there's no visible UI otherwise).
const ctxState = ref('none')

let ctx: AudioContext | null = null
let master: GainNode | null = null // duck gain: 1 normally, low while a tab is audible
type Sound = { nodes: AudioNode[]; gain: GainNode }
let current: Sound | null = null

function ensureCtx(): void {
  if (ctx) return
  ctx = new AudioContext()
  master = ctx.createGain()
  // Start at the current duck level: if a tab is already audible when the first
  // sound begins, the ducked watcher won't fire (value unchanged), so honour it here.
  master.gain.value = store.ambientDucked ? 0.15 : 1
  master.connect(ctx.destination)
}

// A few seconds of looping noise, colored by `type`.
function noiseBuffer(type: 'white' | 'brown' | 'pink'): AudioBuffer {
  const len = Math.floor(ctx!.sampleRate * 5)
  const buf = ctx!.createBuffer(1, len, ctx!.sampleRate)
  const d = buf.getChannelData(0)
  if (type === 'brown') {
    let last = 0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      last = (last + 0.02 * w) / 1.02
      d[i] = last * 3.5
    }
  } else if (type === 'pink') {
    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      b0 = 0.99886 * b0 + w * 0.0555179
      b1 = 0.99332 * b1 + w * 0.0750759
      b2 = 0.969 * b2 + w * 0.153852
      b3 = 0.8665 * b3 + w * 0.3104856
      b4 = 0.55 * b4 + w * 0.5329522
      b5 = -0.7616 * b5 - w * 0.016898
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11
      b6 = w * 0.115926
    }
  } else {
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  }
  return buf
}

// Build a sound's node graph into a fresh gain node (starts silent). Returns the
// gain + all nodes (for teardown) + the target volume to fade up to.
function buildSound(id: string): { nodes: AudioNode[]; gain: GainNode; target: number } {
  const c = ctx!
  const gain = c.createGain()
  gain.gain.value = 0
  gain.connect(master!)
  const src = c.createBufferSource()
  src.loop = true
  const nodes: AudioNode[] = [gain, src]
  let target = 0.4

  if (id === 'rain') {
    src.buffer = noiseBuffer('white')
    const hp = c.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 520
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 7000
    src.connect(hp)
    hp.connect(lp)
    lp.connect(gain)
    nodes.push(hp, lp)
    target = 0.5
  } else if (id === 'wind') {
    src.buffer = noiseBuffer('brown')
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 500
    lp.Q.value = 2
    // Slow LFO on the cutoff gives the sound its drifting, gusting movement.
    const lfo = c.createOscillator()
    lfo.frequency.value = 0.08
    const lfoGain = c.createGain()
    lfoGain.gain.value = 260
    lfo.connect(lfoGain)
    lfoGain.connect(lp.frequency)
    lfo.start()
    src.connect(lp)
    lp.connect(gain)
    nodes.push(lp, lfo, lfoGain)
    target = 0.7
  } else if (id === 'brown') {
    src.buffer = noiseBuffer('brown')
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1100
    src.connect(lp)
    lp.connect(gain)
    nodes.push(lp)
    target = 0.45
  } else {
    // pink
    src.buffer = noiseBuffer('pink')
    src.connect(gain)
    target = 0.4
  }
  src.start()
  return { nodes, gain, target }
}

function fadeOutCurrent(): void {
  if (!current || !ctx) return
  const { gain, nodes } = current
  const now = ctx.currentTime
  gain.gain.cancelScheduledValues(now)
  gain.gain.setValueAtTime(gain.gain.value, now)
  gain.gain.linearRampToValueAtTime(0, now + 1.0)
  // Tear the graph down once it's silent (stop sources, disconnect everything).
  window.setTimeout(() => {
    for (const n of nodes) {
      try {
        ;(n as unknown as { stop?: () => void }).stop?.()
      } catch {
        /* already stopped */
      }
      try {
        n.disconnect()
      } catch {
        /* already disconnected */
      }
    }
  }, 1200)
  current = null
}

function play(id: string): void {
  ensureCtx()
  ctx!.resume().then(() => (ctxState.value = ctx?.state ?? 'none'))
  ctxState.value = ctx!.state
  fadeOutCurrent()
  const built = buildSound(id)
  const now = ctx!.currentTime
  built.gain.gain.setValueAtTime(0, now)
  built.gain.gain.linearRampToValueAtTime(built.target, now + 1.5)
  current = { nodes: built.nodes, gain: built.gain }
}

function setDucked(ducked: boolean): void {
  if (!ctx || !master) return
  const now = ctx.currentTime
  master.gain.cancelScheduledValues(now)
  master.gain.setValueAtTime(master.gain.value, now)
  master.gain.linearRampToValueAtTime(ducked ? 0.15 : 1, now + 0.6)
}

watch(
  () => store.ambientSound,
  (sound) => {
    if (sound) play(sound)
    else fadeOutCurrent()
  },
  { immediate: true }
)
watch(
  () => store.ambientDucked,
  (ducked) => setDucked(ducked)
)

onBeforeUnmount(() => {
  fadeOutCurrent()
  ctx?.close()
})
</script>

<template>
  <span
    class="ambient-audio"
    style="display: none"
    aria-hidden="true"
    :data-ambient="store.ambientSound ?? 'off'"
    :data-ducked="store.ambientDucked"
    :data-ctx="ctxState"
  />
</template>
