<template>
  <div v-if="store.hasTrack" class="flyover-controls">
    <button class="btn-play" @click="togglePlay">
      {{ store.isFlyoverPlaying ? '⏸ 暂停' : '▶ 飞越回放' }}
    </button>

    <div class="progress-row">
      <input
        type="range"
        min="0"
        max="1000"
        :value="Math.round(store.flyoverProgress * 1000)"
        @input="onScrub"
      />
      <span class="pct">{{ Math.round(store.flyoverProgress * 100) }}%</span>
    </div>

    <div class="speed-row">
      <label>速度</label>
      <input
        type="range"
        min="1"
        max="40"
        :value="store.flyoverSpeed"
        @input="onSpeed"
      />
      <span>{{ store.flyoverSpeed }}×</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTrackStore } from '@/state/trackStore'
import { flyoverEngine } from '@/lib/flyover'

const store = useTrackStore()

function togglePlay() {
  store.isFlyoverPlaying = !store.isFlyoverPlaying
}

function onScrub(e: Event) {
  const v = Number((e.target as HTMLInputElement).value) / 1000
  store.isFlyoverPlaying = false
  store.flyoverProgress = v
  flyoverEngine.seek(v)
}

function onSpeed(e: Event) {
  store.flyoverSpeed = Number((e.target as HTMLInputElement).value)
}
</script>

<style scoped>
.flyover-controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--sb-border);
}
.btn-play {
  padding: 6px 14px;
  background: var(--sb-blue);
  color: white;
  border: none;
  border-radius: var(--r);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: background 0.15s;
  align-self: flex-start;
}
.btn-play:hover { background: #3a7ef0; }
.progress-row, .speed-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--sb-ink3);
}
.progress-row input, .speed-row input {
  flex: 1;
  accent-color: var(--sb-blue);
}
.pct { min-width: 32px; text-align: right; font-size: 12px; color: var(--sb-ink3); }
label { min-width: 28px; font-size: 12px; }
</style>
